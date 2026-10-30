package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/technology-lab/go-cassandra/internal/config"
	"github.com/technology-lab/go-cassandra/internal/database"
	"github.com/technology-lab/go-cassandra/internal/handlers"
)

func main() {
	cfg := config.Load()

	store, err := database.New(cfg)
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}
	defer store.Close()

	// Connect in the background so the API is reachable while Cassandra is still starting.
	// If this fails, the health endpoints keep retrying on each request.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		if err := store.Ping(ctx); err != nil {
			log.Printf("Cassandra not available at startup (%T); will retry on health checks", err)
		}
	}()

	mux := http.NewServeMux()
	health := &handlers.Health{DB: store, Timeout: cfg.CassandraConnTimeout + cfg.CassandraTimeout}
	health.Register(mux)
	mux.HandleFunc("/", handlers.NotFound)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handlers.Logging(handlers.CORS(cfg.AllowedOrigins, mux)),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("%s listening on port %s", handlers.ServiceName, cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
