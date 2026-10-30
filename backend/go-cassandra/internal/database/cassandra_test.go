package database

import (
	"context"
	"errors"
	"testing"
	"time"

	gocql "github.com/apache/cassandra-gocql-driver/v2"

	"github.com/technology-lab/go-cassandra/internal/config"
)

// Integration tests: they need Cassandra running (docker compose up -d cassandra).
// Skip them with `go test -short ./...`.

func loadConfig(t *testing.T) config.Config {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test skipped in -short mode")
	}
	config.LoadDotEnv("../../.env")
	return config.Load()
}

func newStore(t *testing.T, cfg config.Config) *Store {
	t.Helper()
	store, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(store.Close)
	return store
}

func TestPing(t *testing.T) {
	store := newStore(t, loadConfig(t))
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := store.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}
}

func TestInsertAndRetrieveRecord(t *testing.T) {
	store := newStore(t, loadConfig(t))
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	created, err := store.InsertRecord(ctx)
	if err != nil {
		t.Fatalf("InsertRecord: %v", err)
	}
	t.Cleanup(func() { _ = store.DeleteRecord(context.Background(), created.ID) })

	fetched, err := store.GetRecord(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetRecord: %v", err)
	}
	if fetched.ID != created.ID {
		t.Errorf("ID = %v, want %v", fetched.ID, created.ID)
	}
	if !fetched.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("CreatedAt = %v, want %v", fetched.CreatedAt, created.CreatedAt)
	}

	if err := store.DeleteRecord(ctx, created.ID); err != nil {
		t.Fatalf("DeleteRecord: %v", err)
	}
	if _, err := store.GetRecord(ctx, created.ID); !errors.Is(err, gocql.ErrNotFound) {
		t.Errorf("after delete: err = %v, want ErrNotFound", err)
	}
}

func TestPingUnavailable(t *testing.T) {
	cfg := loadConfig(t)
	cfg.CassandraPort = 1 // nothing listens here
	cfg.CassandraConnTimeout = time.Second
	store := newStore(t, cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	if err := store.Ping(ctx); err == nil {
		t.Fatal("Ping succeeded against an unavailable Cassandra")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("Ping took %v; expected it to fail within the timeout", elapsed)
	}
}

func TestPingRespectsContextDeadline(t *testing.T) {
	cfg := loadConfig(t)
	cfg.CassandraHosts = []string{"10.255.255.1"} // unroutable: connecting hangs until ConnectTimeout
	cfg.CassandraConnTimeout = 5 * time.Second
	store := newStore(t, cfg)

	// Several concurrent callers share one connection attempt; each must give up at its own deadline.
	errs := make(chan error, 3)
	start := time.Now()
	for range 3 {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			errs <- store.Ping(ctx)
		}()
	}
	for range 3 {
		if err := <-errs; !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("err = %v, want context.DeadlineExceeded", err)
		}
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("callers waited %v; expected about 1s", elapsed)
	}
}

func TestInvalidKeyspaceRejected(t *testing.T) {
	cfg := config.Config{CassandraKeyspace: "bad; DROP KEYSPACE x"}
	if _, err := New(cfg); err == nil {
		t.Fatal("expected invalid keyspace to be rejected")
	}
}
