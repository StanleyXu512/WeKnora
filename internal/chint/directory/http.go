package directory

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Register is called on an authenticated, strictly system-admin-only group.
func (r *Runtime) Register(group *gin.RouterGroup, actor func(*gin.Context) string) {
	group.GET("/status", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true, "data": r.Status()}) })
	if r.Service == nil {
		return
	}
	group.POST("/imports", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxBytes)
		b, err := DecodeBatch(c.Request.Body)
		if err != nil {
			var tooLarge *http.MaxBytesError
			status := http.StatusBadRequest
			if errors.As(err, &tooLarge) {
				status = http.StatusRequestEntityTooLarge
			}
			c.JSON(status, gin.H{"success": false, "error": "JSON 批次格式无效或超过 10 MiB"})
			return
		}
		dry := c.Query("dry_run")
		if dry != "" && dry != "true" && dry != "false" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "dry_run 仅支持 true/false"})
			return
		}
		report, err := r.Service.Import(c.Request.Context(), b, actor(c), dry == "true")
		if err != nil {
			respondError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": report})
	})
	group.GET("/organizations", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListOrganizations(c.Request.Context(), c.Query("source_id"), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})
	group.GET("/identities", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListIdentities(c.Request.Context(), c.Query("source_id"), c.Query("tenant_id"), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})

	group.GET("/people", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListPeople(c.Request.Context(), c.Query("source_id"), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})
	group.GET("/imports", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListReports(c.Request.Context(), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})
	group.GET("/bindings", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListBindings(c.Request.Context(), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})
	group.GET("/suspensions", func(c *gin.Context) {
		limit, offset, ok := pagination(c)
		if !ok {
			return
		}
		rows, err := r.Service.ListSuspensions(c.Request.Context(), limit, offset)
		respondRows(c, rows, err, limit, offset)
	})
	group.PUT("/suspensions", func(c *gin.Context) {
		var req struct {
			SourceID string `json:"source_id"`
			PersonID string `json:"person_id"`
			Reason   string `json:"reason"`
			Active   *bool  `json:"active"`
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		if err := c.ShouldBindJSON(&req); err != nil || req.Active == nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "需提供人员标识、active 和停用原因"})
			return
		}
		if err := r.Service.Suspend(c.Request.Context(), req.SourceID, req.PersonID, req.Reason, actor(c), *req.Active); err != nil {
			respondError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	group.PUT("/bindings", func(c *gin.Context) {
		var req struct {
			SourceID string `json:"source_id"`
			PersonID string `json:"person_id"`
			UserID   string `json:"user_id"`
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "账号绑定参数无效"})
			return
		}
		if err := r.Service.Bind(c.Request.Context(), req.SourceID, req.PersonID, req.UserID, actor(c)); err != nil {
			respondError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
}
func pagination(c *gin.Context) (int, int, bool) {
	limit, err1 := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, err2 := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err1 != nil || err2 != nil || limit < 1 || limit > 200 || offset < 0 || offset > 1000000 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "分页参数无效，limit 为 1–200"})
		return 0, 0, false
	}
	return limit, offset, true
}
func respondRows(c *gin.Context, rows any, err error, limit, offset int) {
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows, "limit": limit, "offset": offset})
}
func respondError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "集团目录操作失败"
	if errors.Is(err, ErrConflict) {
		status = http.StatusConflict
		message = ErrConflict.Error()
	}
	if errors.Is(err, ErrBinding) {
		status = http.StatusBadRequest
		message = ErrBinding.Error()
	}
	c.JSON(status, gin.H{"success": false, "error": message})
}
