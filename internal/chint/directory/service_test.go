package directory

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testService(t *testing.T) *Service {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "directory.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(db)
	if err := s.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.Exec(`CREATE TABLE users (id TEXT PRIMARY KEY, is_active BOOLEAN, is_system_admin BOOLEAN, deleted_at DATETIME)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO users (id,is_active,is_system_admin) VALUES ('local-a',1,0),('local-b',1,0),('admin',1,1),('disabled',0,0)`).Error; err != nil {
		t.Fatal(err)
	}
	return s
}
func sampleBatch() Batch {
	return Batch{SourceID: "group", BatchID: "batch-1", Sequence: 1, Mode: "full", Complete: true,
		Organizations: []OrganizationInput{{ID: "a", Name: "组织 A", Status: "active"}, {ID: "b", Name: "组织 B", Status: "active"}},
		People:        []PersonInput{{ID: "person-a", Name: "人员 A", OrgID: "a", Status: "active", FeishuIdentities: []FeishuIdentity{{TenantID: "tenant-1", UserID: "u"}, {TenantID: "tenant-2", UserID: "u"}, {TenantID: "tenant-3", UserID: "u"}}}, {ID: "person-b", Name: "人员 B", OrgID: "b", Status: "active"}}}
}
func apply(t *testing.T, s *Service, b Batch) *Report {
	t.Helper()
	r, err := s.Import(context.Background(), b, "test-admin", false)
	if err != nil {
		t.Fatal(err)
	}
	if r.Status != "applied" {
		t.Fatalf("not applied: %+v", r)
	}
	return r
}
func count(t *testing.T, s *Service, model any) int64 {
	t.Helper()
	var n int64
	if err := s.db.Model(model).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestImportDryRunAndIdempotency(t *testing.T) {
	s := testService(t)
	b := sampleBatch()
	ctx := context.Background()
	r, err := s.Import(ctx, b, "admin", true)
	if err != nil || r.Status != "validated" || !r.DryRun {
		t.Fatalf("preview: %+v %v", r, err)
	}
	if count(t, s, &Organization{}) != 0 || count(t, s, &Report{}) != 0 || count(t, s, &Source{}) != 0 {
		t.Fatal("preview wrote data")
	}
	apply(t, s, b)
	r, err = s.Import(ctx, b, "other-admin", false)
	if err != nil || !r.Replay || r.Actor != "test-admin" {
		t.Fatalf("replay changed original report: %+v %v", r, err)
	}
	if count(t, s, &Person{}) != 2 || count(t, s, &Identity{}) != 3 || count(t, s, &Report{}) != 1 {
		t.Fatal("duplicate import")
	}
	b.People[0].Name = "changed"
	if _, err = s.Import(ctx, b, "admin", false); !errors.Is(err, ErrConflict) {
		t.Fatalf("expected digest conflict, got %v", err)
	}
}
func TestImportRejectsInvalidGraphAtomically(t *testing.T) {
	cases := map[string]func(*Batch){
		"cycle":              func(b *Batch) { b.Organizations[0].ParentID = "b"; b.Organizations[1].ParentID = "a" },
		"missing-parent":     func(b *Batch) { b.Organizations[0].ParentID = "missing" },
		"missing-org":        func(b *Batch) { b.People[0].OrgID = "missing" },
		"duplicate-person":   func(b *Batch) { b.People = append(b.People, b.People[0]) },
		"duplicate-identity": func(b *Batch) { b.People[1].FeishuIdentities = []FeishuIdentity{{TenantID: "tenant-1", UserID: "u"}} },
		"incomplete":         func(b *Batch) { b.Complete = false },
		"invalid-status":     func(b *Batch) { b.People[0].Status = "deleted" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			s := testService(t)
			b := sampleBatch()
			change(&b)
			r, err := s.Import(context.Background(), b, "admin", false)
			if err != nil || r.Status != "rejected" || r.IssueCount == 0 {
				t.Fatalf("invalid batch accepted: %+v %v", r, err)
			}
			if count(t, s, &Person{}) != 0 || count(t, s, &Organization{}) != 0 || count(t, s, &Identity{}) != 0 {
				t.Fatal("rejection partially wrote master data")
			}
			if count(t, s, &Report{}) != 1 {
				t.Fatal("rejection missing persisted report")
			}
		})
	}
}
func TestMissingRecordsAreNotDeletedAndStaleSequenceIsRejected(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	b := Batch{SourceID: "group", BatchID: "batch-3", Sequence: 3, Mode: "full", Complete: true, People: []PersonInput{{ID: "person-a", Name: "Updated", OrgID: "a", Status: "active"}}}
	apply(t, s, b)
	if count(t, s, &Person{}) != 2 || count(t, s, &Organization{}) != 2 {
		t.Fatal("absent records were deleted")
	}
	b.BatchID = "late-batch"
	b.Sequence = 2
	if _, err := s.Import(context.Background(), b, "admin", false); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale batch accepted: %v", err)
	}
}
func TestExistingGraphAndIdentitiesParticipateInValidation(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	b := Batch{SourceID: "group", BatchID: "bad-update", Sequence: 2, Mode: "delta", Complete: true, Organizations: []OrganizationInput{{ID: "a", Name: "组织 A", Status: "inactive"}}}
	r, err := s.Import(context.Background(), b, "admin", false)
	if err != nil || r.Status != "rejected" {
		t.Fatalf("active existing member ignored: %+v %v", r, err)
	}
	b.BatchID = "bad-identity"
	b.Organizations = nil
	b.People = []PersonInput{{ID: "new-person", Name: "New", OrgID: "b", Status: "active", FeishuIdentities: []FeishuIdentity{{TenantID: "tenant-1", UserID: "u"}}}}
	r, err = s.Import(context.Background(), b, "admin", false)
	if err != nil || r.Status != "rejected" {
		t.Fatalf("existing identity ignored: %+v %v", r, err)
	}
}
func TestIdentityTransferWithinOneBatch(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	b := sampleBatch()
	b.BatchID = "transfer"
	b.Sequence = 2
	b.Mode = "delta"
	b.People[1].FeishuIdentities = b.People[0].FeishuIdentities
	b.People[0].FeishuIdentities = []FeishuIdentity{}
	apply(t, s, b)
	var rows []Identity
	if err := s.db.Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.PersonID != "person-b" {
			t.Fatalf("transfer failed: %+v", row)
		}
	}
}
func TestDatabaseFailureRollsBackWholeBatch(t *testing.T) {
	s := testService(t)
	if err := s.db.Callback().Create().Before("gorm:create").Register("test:fail-person", func(tx *gorm.DB) {
		if tx.Statement.Table == "chint_directory_people" {
			tx.AddError(errors.New("injected write failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	_, err := s.Import(context.Background(), sampleBatch(), "admin", false)
	if err == nil {
		t.Fatal("expected database error")
	}
	if count(t, s, &Organization{}) != 0 || count(t, s, &Person{}) != 0 || count(t, s, &Source{}) != 0 || count(t, s, &Report{}) != 0 {
		t.Fatal("transaction was not rolled back")
	}
}
func TestBindingAndCurrentStatus(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	ctx := context.Background()
	for _, user := range []string{"admin", "disabled", "missing"} {
		if err := s.Bind(ctx, "group", "person-a", user, "admin"); !errors.Is(err, ErrBinding) {
			t.Fatalf("unsafe binding %s accepted: %v", user, err)
		}
	}
	if err := s.Bind(ctx, "group", "person-a", "local-a", "admin"); err != nil {
		t.Fatal(err)
	}
	if err := s.Bind(ctx, "group", "person-b", "local-a", "admin"); !errors.Is(err, ErrBinding) {
		t.Fatal("account can impersonate two people")
	}
	if err := s.CheckUser(ctx, "local-a"); err != nil {
		t.Fatal(err)
	}
	b := Batch{SourceID: "group", BatchID: "leave", Sequence: 2, Mode: "delta", Complete: true, People: []PersonInput{{ID: "person-a", Name: "人员 A", OrgID: "a", Status: "inactive"}}}
	apply(t, s, b)
	if err := s.CheckUser(ctx, "local-a"); !errors.Is(err, ErrInactive) {
		t.Fatalf("inactive binding was not blocked: %v", err)
	}
	if err := s.CheckUser(ctx, "local-b"); err != nil {
		t.Fatalf("unbound local account changed: %v", err)
	}
	b.BatchID = "restore"
	b.Sequence = 3
	b.People[0].Status = "active"
	apply(t, s, b)
	if err := s.CheckUser(ctx, "local-a"); err != nil {
		t.Fatal(err)
	}
	if count(t, s, &BindingAudit{}) != 1 {
		t.Fatal("binding audit missing")
	}
}

func TestEmergencySuspensionSurvivesDailyImport(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	ctx := context.Background()
	if err := s.Bind(ctx, "group", "person-a", "local-a", "admin"); err != nil {
		t.Fatal(err)
	}
	if err := s.Suspend(ctx, "group", "person-a", "紧急停用", "admin", true); err != nil {
		t.Fatal(err)
	}
	if err := s.CheckUser(ctx, "local-a"); !errors.Is(err, ErrInactive) {
		t.Fatalf("suspension not enforced: %v", err)
	}
	b := sampleBatch()
	b.Sequence = 2
	b.BatchID = "daily"
	apply(t, s, b)
	if err := s.CheckUser(ctx, "local-a"); !errors.Is(err, ErrInactive) {
		t.Fatal("daily import cleared override")
	}
	if err := s.Suspend(ctx, "group", "person-a", "已复核恢复", "admin", false); err != nil {
		t.Fatal(err)
	}
	if err := s.CheckUser(ctx, "local-a"); err != nil {
		t.Fatal(err)
	}
	if count(t, s, &BindingAudit{}) != 3 {
		t.Fatal("suspension actions were not audited")
	}
}

func TestOmittedIdentitiesArePreserved(t *testing.T) {
	s := testService(t)
	apply(t, s, sampleBatch())
	b := Batch{SourceID: "group", BatchID: "name-update", Sequence: 2, Mode: "delta", Complete: true, People: []PersonInput{{ID: "person-a", Name: "Updated", OrgID: "a", Status: "active"}}}
	apply(t, s, b)
	if count(t, s, &Identity{}) != 3 {
		t.Fatal("omitted identities unexpectedly removed")
	}
	b.BatchID = "explicit-clear"
	b.Sequence = 3
	b.People[0].FeishuIdentities = []FeishuIdentity{}
	apply(t, s, b)
	if count(t, s, &Identity{}) != 0 {
		t.Fatal("explicit empty identities did not clear mapping")
	}
}
