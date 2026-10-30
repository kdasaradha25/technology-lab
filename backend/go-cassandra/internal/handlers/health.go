// Package handlers implements the HTTP endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"slices"
	"time"
)

const (
	ServiceName  = "go-cassandra-api"
	DatabaseType = "cassandra"
)

// Response bodies are structs (not maps) so JSON fields keep the shared contract's order.
type serviceStatus struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type databaseInfo struct {
	Status string `json:"status"`
	Type   string `json:"type"`
}

type appStatus struct {
	Status   string       `json:"status"`
	Service  string       `json:"service"`
	Database databaseInfo `json:"database"`
}

type dbStatus struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Message  string `json:"message"`
}

type errorBody struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// Pinger is the one database operation the health handlers need.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Health serves the three health endpoints.
type Health struct {
	DB Pinger
	// Timeout bounds a whole database check, including connecting if needed.
	Timeout time.Duration
}

// Register adds the health routes to mux.
func (h *Health) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /health/app", h.healthApp)
	mux.HandleFunc("GET /health/db", h.healthDB)
}

func (h *Health) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, serviceStatus{Status: "healthy", Service: ServiceName})
}

func (h *Health) healthApp(w http.ResponseWriter, r *http.Request) {
	dbOK := h.checkDatabase(r.Context())
	status, code := statusFor(dbOK)
	writeJSON(w, code, appStatus{
		Status:   status,
		Service:  ServiceName,
		Database: databaseInfo{Status: status, Type: DatabaseType},
	})
}

func (h *Health) healthDB(w http.ResponseWriter, r *http.Request) {
	if h.checkDatabase(r.Context()) {
		writeJSON(w, http.StatusOK, dbStatus{
			Status:   "healthy",
			Database: DatabaseType,
			Message:  "Database connection successful",
		})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, dbStatus{
		Status:   "unhealthy",
		Database: DatabaseType,
		Message:  "Database connection failed",
	})
}

func (h *Health) checkDatabase(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, h.Timeout)
	defer cancel()

	if err := h.DB.Ping(ctx); err != nil {
		// Log the error type only: driver messages can include host names.
		log.Printf("Cassandra health check failed: %T", err)
		return false
	}
	return true
}

func statusFor(ok bool) (string, int) {
	if ok {
		return "healthy", http.StatusOK
	}
	return "unhealthy", http.StatusServiceUnavailable
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response: %v", err)
	}
}

// NotFound returns a JSON 404 for unknown routes.
func NotFound(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, errorBody{Status: "error", Message: "Not found"})
}

// CORS allows GET requests from the configured frontend origins.
func CORS(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(allowedOrigins, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Logging writes one line per request.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}
