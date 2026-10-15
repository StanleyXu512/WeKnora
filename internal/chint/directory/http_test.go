package directory

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestHTTPImportAndPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := testService(t)
	r := gin.New()
	runtime := &Runtime{Service: s}
	runtime.Register(r.Group("/directory"), func(*gin.Context) string { return "admin" })
	data, _ := json.Marshal(sampleBatch())
	for _, path := range []string{"/directory/imports?dry_run=true", "/directory/imports?dry_run=false"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
	}
	for _, path := range []string{"/directory/people?limit=0", "/directory/imports?offset=-1", "/directory/bindings?limit=201"} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != 400 {
			t.Fatalf("invalid pagination: %d", w.Code)
		}
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/directory/people?limit=1&offset=1", nil))
	var response struct {
		Data []Person `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Data) != 1 || response.Data[0].ID != "person-b" {
		t.Fatalf("pagination ignored: %s", w.Body.String())
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/directory/imports", strings.NewReader(`{"password":"secret"}`)))
	if w.Code != 400 || strings.Contains(w.Body.String(), "secret") {
		t.Fatal("invalid JSON exposed request content")
	}
}
