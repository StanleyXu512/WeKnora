package router

import (
	"errors"
	"net/http"

	"github.com/Tencent/WeKnora/internal/chint/directory"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/gin-gonic/gin"
)

func registerCHINTDirectory(r *gin.RouterGroup, runtime *directory.Runtime) {
	if runtime == nil {
		return
	}
	group := r.Group("/system/admin/chint/directory", func(c *gin.Context) {
		ctx := c.Request.Context()
		_, user := types.UserIDFromContext(ctx)
		_, key := types.TenantAPIKeyScopeFromContext(ctx)
		if !user || key || !types.IsSystemAdminFromContext(ctx) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "error": "仅系统管理员可管理集团目录"})
			return
		}
		c.Next()
	})
	runtime.Register(group, func(c *gin.Context) string { id, _ := types.UserIDFromContext(c.Request.Context()); return id })
}

// Current status is checked on every authenticated local-user request, including old JWTs.
// API keys/external principals need separate delegation rules in the Open API phase.
func chintDirectoryAccess(runtime *directory.Runtime) gin.HandlerFunc {
	return func(c *gin.Context) {
		if runtime == nil || runtime.Service == nil {
			c.Next()
			return
		}
		ctx := c.Request.Context()
		id, ok := types.UserIDFromContext(ctx)
		if !ok || types.IsSystemAdminFromContext(ctx) {
			c.Next()
			return
		}
		if _, key := types.TenantAPIKeyScopeFromContext(ctx); key {
			c.Next()
			return
		}
		err := runtime.Service.CheckUser(ctx, id)
		if err != nil {
			status := http.StatusServiceUnavailable
			message := "集团人员状态暂时无法验证"
			if errors.Is(err, directory.ErrInactive) {
				status = http.StatusForbidden
				message = directory.ErrInactive.Error()
			}
			c.AbortWithStatusJSON(status, gin.H{"success": false, "error": message})
			return
		}
		c.Next()
	}
}
