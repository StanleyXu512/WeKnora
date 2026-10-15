package directory

import (
	"context"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Supply a disposable database. This test is deliberately opt-in and writes only test data.
func TestPostgresConcurrentImport(t *testing.T) {
	dsn := os.Getenv("CHINT_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("requires disposable PostgreSQL database")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	s := NewService(db)
	if err := s.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	b := sampleBatch()
	b.SourceID = "concurrency-" + time.Now().UTC().Format("20060102150405.000000000")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	var applied, replays atomic.Int32
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := s.Import(ctx, b, "test-admin", false)
			if err != nil {
				errs <- err
				return
			}
			if r.Replay {
				replays.Add(1)
			} else if r.Status == "applied" {
				applied.Add(1)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	if applied.Load() != 1 || replays.Load() != 7 {
		t.Fatalf("expected one commit/seven replays, got %d/%d", applied.Load(), replays.Load())
	}
	var n int64
	if err := db.Model(&Report{}).Where("source_id = ?", b.SourceID).Count(&n).Error; err != nil || n != 1 {
		t.Fatalf("batch duplicates: %d %v", n, err)
	}
	b.BatchID = "invalid"
	b.Sequence = 2
	b.Organizations[0].ParentID = "b"
	b.Organizations[1].ParentID = "a"
	r, err := s.Import(ctx, b, "test-admin", false)
	if err != nil || r.Status != "rejected" {
		t.Fatalf("invalid graph accepted: %+v %v", r, err)
	}
	var org Organization
	if err := db.Where("source_id = ? AND id = ?", b.SourceID, "a").First(&org).Error; err != nil || org.ParentID != "" {
		t.Fatal("rejected graph partially committed")
	}
}
