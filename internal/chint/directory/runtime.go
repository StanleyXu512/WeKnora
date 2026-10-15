package directory

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
	_ "time/tzdata" // Keep the configured timezone available in minimal images.

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

const MaxBytes = 10 << 20

type Config struct {
	Enabled  bool   `json:"enabled"`
	File     string `json:"-"`
	Schedule string `json:"schedule"`
	Timezone string `json:"timezone"`
}

func ConfigFromEnv() (Config, error) {
	c := Config{Schedule: "0 2 * * *", Timezone: "Asia/Shanghai"}
	if value := os.Getenv("CHINT_ENABLED"); value != "" {
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return c, fmt.Errorf("CHINT_ENABLED must be a boolean")
		}
		c.Enabled = enabled
	}
	if !c.Enabled {
		return c, nil
	}
	c.File = os.Getenv("CHINT_DIRECTORY_IMPORT_FILE")
	if value, ok := os.LookupEnv("CHINT_DIRECTORY_IMPORT_CRON"); ok {
		c.Schedule = value
	}
	if value := os.Getenv("CHINT_DIRECTORY_IMPORT_TIMEZONE"); value != "" {
		c.Timezone = value
	}
	if c.File != "" && !filepath.IsAbs(c.File) {
		return c, fmt.Errorf("CHINT_DIRECTORY_IMPORT_FILE must be absolute")
	}
	if _, err := time.LoadLocation(c.Timezone); err != nil {
		return c, fmt.Errorf("invalid CHINT directory timezone")
	}
	if c.Schedule != "" {
		if _, err := cron.ParseStandard(c.Schedule); err != nil {
			return c, fmt.Errorf("invalid CHINT directory cron: %w", err)
		}
	}
	return c, nil
}

// DecodeBatch rejects unknown fields, trailing JSON and oversized payloads.
func DecodeBatch(r io.Reader) (Batch, error) {
	var b Batch
	data, err := io.ReadAll(io.LimitReader(r, MaxBytes+1))
	if err != nil {
		return b, err
	}
	if len(data) > MaxBytes {
		return b, fmt.Errorf("导入文件不能超过 10 MiB")
	}
	return decodeBytes(data)
}

func decodeBytes(data []byte) (Batch, error) {
	var b Batch
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return b, fmt.Errorf("批次必须是 JSON 对象")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(&b); err != nil {
		return b, fmt.Errorf("JSON 字段或格式无效: %w", err)
	}
	var extra any
	if err := d.Decode(&extra); !errors.Is(err, io.EOF) {
		return b, fmt.Errorf("只允许一个 JSON 批次")
	}
	return b, nil
}

type RuntimeStatus struct {
	Config
	FileConfigured bool       `json:"file_configured"`
	Scheduled      bool       `json:"scheduled"`
	Running        bool       `json:"running"`
	LastStartedAt  *time.Time `json:"last_started_at,omitempty"`
	LastFinishedAt *time.Time `json:"last_finished_at,omitempty"`
	LastStatus     string     `json:"last_status"`
}

type Runtime struct {
	Service *Service
	config  Config
	cron    *cron.Cron
	jobMu   sync.Mutex
	mu      sync.Mutex
	status  RuntimeStatus
}

func NewRuntime(db *gorm.DB) (*Runtime, error) {
	c, err := ConfigFromEnv()
	if err != nil {
		return nil, err
	}
	return NewRuntimeWithConfig(db, c)
}
func NewRuntimeWithConfig(db *gorm.DB, c Config) (*Runtime, error) {
	r := &Runtime{config: c, status: RuntimeStatus{Config: c, FileConfigured: c.File != "", LastStatus: "never"}}
	if !c.Enabled {
		return r, nil
	}
	r.Service = NewService(db)
	if err := r.Service.Migrate(context.Background()); err != nil {
		return nil, fmt.Errorf("CHINT additive schema migration: %w", err)
	}
	if c.File != "" && c.Schedule != "" {
		loc, err := time.LoadLocation(c.Timezone)
		if err != nil {
			return nil, err
		}
		r.cron = cron.New(cron.WithLocation(loc), cron.WithChain(cron.Recover(cron.DefaultLogger)))
		if _, err := r.cron.AddFunc(c.Schedule, func() { r.RunFile(context.Background()) }); err != nil {
			return nil, err
		}
		r.status.Scheduled = true
	}
	return r, nil
}
func (r *Runtime) Start() {
	if r.cron != nil {
		r.cron.Start()
	}
}
func (r *Runtime) Stop(ctx context.Context) {
	if r.cron == nil {
		return
	}
	select {
	case <-r.cron.Stop().Done():
	case <-ctx.Done():
	}
}
func (r *Runtime) Status() RuntimeStatus { r.mu.Lock(); defer r.mu.Unlock(); return r.status }
func (r *Runtime) RunFile(ctx context.Context) {
	if r.Service == nil || r.config.File == "" || !r.jobMu.TryLock() {
		return
	}
	defer r.jobMu.Unlock()
	now := time.Now().UTC()
	r.mu.Lock()
	r.status.Running = true
	r.status.LastStartedAt = &now
	r.mu.Unlock()
	status := "failed"
	defer func() {
		end := time.Now().UTC()
		r.mu.Lock()
		r.status.Running = false
		r.status.LastFinishedAt = &end
		r.status.LastStatus = status
		r.mu.Unlock()
	}()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	// The producer must atomically rename a complete snapshot into this path.
	f, err := os.Open(r.config.File)
	if err != nil {
		slog.Error("CHINT directory import: cannot open configured file")
		return
	}
	defer f.Close()
	b, err := DecodeBatch(f)
	if err != nil {
		slog.Error("CHINT directory import: invalid snapshot")
		return
	}
	report, err := r.Service.Import(ctx, b, "scheduler", false)
	if err != nil {
		slog.Error("CHINT directory import: transaction failed")
		return
	}
	status = report.Status
	if report.Replay {
		status = "replayed"
	}
	slog.Info("CHINT directory scheduled import completed", "status", status, "issues", report.IssueCount)
}
