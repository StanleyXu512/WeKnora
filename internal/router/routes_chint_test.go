package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/Tencent/WeKnora/internal/chint/directory"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestCHINTDirectoryAdminGuard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name  string
		user  bool
		admin bool
		key   bool
		want  int
	}{{"anonymous", false, false, false, 403}, {"member", true, false, false, 403}, {"system-admin", true, true, false, 200}, {"platform-key", true, true, true, 403}}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.Use(func(c *gin.Context) {
				ctx := c.Request.Context()
				if tc.user {
					ctx = context.WithValue(ctx, types.UserIDContextKey, "u")
				}
				ctx = context.WithValue(ctx, types.SystemAdminContextKey, tc.admin)
				if tc.key {
					ctx = types.WithTenantAPIKeyScope(ctx, types.TenantAPIKeyScope{ScopeType: types.APIKeyScopePlatform, FullAccess: true})
				}
				c.Request = c.Request.WithContext(ctx)
				c.Next()
			})
			runtime, err := directory.NewRuntimeWithConfig(nil, directory.Config{})
			if err != nil {
				t.Fatal(err)
			}
			registerCHINTDirectory(r.Group("/api/v1"), runtime)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/system/admin/chint/directory/status", nil))
			if w.Code != tc.want {
				t.Fatalf("guard returned %d, want %d", w.Code, tc.want)
			}
		})
	}
}
func TestCHINTDirectoryAccessChecksExistingSession(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "directory.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { _ = sqlDB.Close() })
	runtime, err := directory.NewRuntimeWithConfig(db, directory.Config{Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`CREATE TABLE users (id TEXT PRIMARY KEY,is_active BOOLEAN,is_system_admin BOOLEAN,deleted_at DATETIME)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO users VALUES ('local-user',1,0,NULL)`).Error; err != nil {
		t.Fatal(err)
	}
	var b directory.Batch
	if err := json.Unmarshal([]byte(`{"source_id":"group","batch_id":"one","sequence":1,"mode":"full","complete":true,"organizations":[{"id":"org","name":"Org","status":"active"}],"people":[{"id":"person","name":"Person","org_id":"org","status":"active"}]}`), &b); err != nil {
		t.Fatal(err)
	}
	if _, err := runtime.Service.Import(context.Background(), b, "admin", false); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Service.Bind(context.Background(), "group", "person", "local-user", "admin"); err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), types.UserIDContextKey, "local-user"))
		c.Next()
	})
	r.Use(chintDirectoryAccess(runtime))
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })
	request := func() int {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", "/protected", nil))
		return w.Code
	}
	if request() != 200 {
		t.Fatal("active session rejected")
	}
	if err := runtime.Service.Suspend(context.Background(), "group", "person", "emergency", "admin", true); err != nil {
		t.Fatal(err)
	}
	if request() != 403 {
		t.Fatal("existing session bypassed suspension")
	}
}
