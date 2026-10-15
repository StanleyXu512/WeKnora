package directory

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecodeBatchStrictAndBounded(t *testing.T) {
	for _, input := range []string{`{"unknown":true}`, `{} {}`, `null`, strings.Repeat(" ", MaxBytes+1)} {
		_, err := DecodeBatch(strings.NewReader(input))
		if err == nil {
			t.Fatalf("malformed input accepted: %.20s", input)
		}
	}
}
func TestScheduledFileReplayAndFailure(t *testing.T) {
	s := testService(t)
	path := filepath.Join(t.TempDir(), "import.json")
	r, err := NewRuntimeWithConfig(s.db, Config{Enabled: true, File: path, Schedule: "", Timezone: "Asia/Shanghai"})
	if err != nil {
		t.Fatal(err)
	}
	r.RunFile(context.Background())
	if r.Status().LastStatus != "failed" {
		t.Fatal("missing file not reported")
	}
	data, _ := json.Marshal(sampleBatch())
	if err := os.WriteFile(path, data, 0600); err != nil {
		t.Fatal(err)
	}
	r.RunFile(context.Background())
	if r.Status().LastStatus != "applied" {
		t.Fatalf("scheduled import failed: %+v", r.Status())
	}
	r.RunFile(context.Background())
	if r.Status().LastStatus != "replayed" || count(t, s, &Report{}) != 1 {
		t.Fatal("scheduled replay duplicated rows")
	}
	if err := os.WriteFile(path, []byte(`{"broken":1}`), 0600); err != nil {
		t.Fatal(err)
	}
	r.RunFile(context.Background())
	if r.Status().LastStatus != "failed" || count(t, s, &Person{}) != 2 {
		t.Fatal("broken snapshot changed directory")
	}
	encoded, _ := json.Marshal(r.Status())
	if strings.Contains(string(encoded), path) {
		t.Fatal("server file path leaked")
	}
}
func TestConfigValidation(t *testing.T) {
	t.Setenv("CHINT_ENABLED", "true")
	t.Setenv("CHINT_DIRECTORY_IMPORT_FILE", "/tmp/import.json")
	t.Setenv("CHINT_DIRECTORY_IMPORT_CRON", "0 2 * * *")
	t.Setenv("CHINT_DIRECTORY_IMPORT_TIMEZONE", "Asia/Shanghai")
	c, err := ConfigFromEnv()
	if err != nil || !c.Enabled {
		t.Fatalf("valid config failed: %+v %v", c, err)
	}
	t.Setenv("CHINT_DIRECTORY_IMPORT_CRON", "invalid")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("invalid schedule accepted")
	}
	t.Setenv("CHINT_ENABLED", "false")
	if _, err := ConfigFromEnv(); err != nil {
		t.Fatal("disabled feature depended on enabled configuration")
	}
}
