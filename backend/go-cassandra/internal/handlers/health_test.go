package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func newServer(db Pinger) http.Handler {
	mux := http.NewServeMux()
	(&Health{DB: db, Timeout: time.Second}).Register(mux)
	mux.HandleFunc("/", NotFound)
	return CORS([]string{"http://localhost:5173"}, mux)
}

func get(t *testing.T, h http.Handler, path string, headers map[string]string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("%s: invalid JSON %q: %v", path, rec.Body.String(), err)
	}
	return rec, body
}

func TestHealthEndpoints(t *testing.T) {
	down := errors.New("connection refused")

	tests := []struct {
		name     string
		dbErr    error
		path     string
		wantCode int
		wantBody map[string]any
	}{
		{"health with db up", nil, "/health", 200,
			map[string]any{"status": "healthy", "service": "go-cassandra-api"}},
		{"health with db down", down, "/health", 200,
			map[string]any{"status": "healthy", "service": "go-cassandra-api"}},
		{"app healthy", nil, "/health/app", 200,
			map[string]any{"status": "healthy", "service": "go-cassandra-api",
				"database": map[string]any{"status": "healthy", "type": "cassandra"}}},
		{"app unhealthy", down, "/health/app", 503,
			map[string]any{"status": "unhealthy", "service": "go-cassandra-api",
				"database": map[string]any{"status": "unhealthy", "type": "cassandra"}}},
		{"db healthy", nil, "/health/db", 200,
			map[string]any{"status": "healthy", "database": "cassandra", "message": "Database connection successful"}},
		{"db unhealthy", down, "/health/db", 503,
			map[string]any{"status": "unhealthy", "database": "cassandra", "message": "Database connection failed"}},
		{"unknown route", nil, "/nope", 404,
			map[string]any{"status": "error", "message": "Not found"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, body := get(t, newServer(fakeDB{tt.dbErr}), tt.path, nil)
			if rec.Code != tt.wantCode {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantCode)
			}
			if !reflect.DeepEqual(body, tt.wantBody) {
				t.Errorf("body = %v, want %v", body, tt.wantBody)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q", ct)
			}
		})
	}
}

func TestCORS(t *testing.T) {
	h := newServer(fakeDB{})

	rec, _ := get(t, h, "/health", map[string]string{"Origin": "http://localhost:5173"})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("allowed origin header = %q", got)
	}

	rec, _ = get(t, h, "/health", map[string]string{"Origin": "http://evil.example"})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unexpected allow-origin header %q for disallowed origin", got)
	}
}
