// Package database manages the Cassandra session, schema, and queries.
package database

import (
	"context"
	"errors"
	"fmt"
	"log"
	"regexp"
	"sync"
	"time"

	gocql "github.com/apache/cassandra-gocql-driver/v2"

	"github.com/technology-lab/go-cassandra/internal/config"
	"github.com/technology-lab/go-cassandra/internal/models"
)

var validKeyspace = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{0,47}$`)

// Store owns a lazily created Cassandra session.
//
// Cassandra can take a minute or more to become ready, so the API never blocks on it at
// startup. The session is created on first use and dropped after a failed health check,
// so the next request reconnects from scratch once Cassandra is back.
type Store struct {
	cfg        config.Config
	mu         sync.Mutex
	session    *gocql.Session
	connecting chan struct{} // non-nil while a connection attempt is in flight
	connErr    error         // result of the last finished attempt
}

// New validates the configuration and returns a Store. It does not connect.
func New(cfg config.Config) (*Store, error) {
	if !validKeyspace.MatchString(cfg.CassandraKeyspace) {
		return nil, fmt.Errorf("invalid CASSANDRA_KEYSPACE %q", cfg.CassandraKeyspace)
	}
	return &Store{cfg: cfg}, nil
}

// getSession returns the current session, connecting and preparing the schema if needed.
//
// gocql's CreateSession cannot be cancelled, so the connection attempt runs in its own
// goroutine. Concurrent callers share that one attempt, and each stops waiting when its own
// context expires, so a slow or unreachable Cassandra never holds a request past its deadline.
func (s *Store) getSession(ctx context.Context) (*gocql.Session, error) {
	s.mu.Lock()
	if s.session != nil && !s.session.Closed() {
		session := s.session
		s.mu.Unlock()
		return session, nil
	}
	if s.connecting == nil {
		done := make(chan struct{})
		s.connecting = done
		go func() {
			session, err := s.connect()
			s.mu.Lock()
			s.session, s.connErr, s.connecting = session, err, nil
			s.mu.Unlock()
			close(done)
		}()
	}
	done := s.connecting
	s.mu.Unlock()

	select {
	case <-done:
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.session == nil {
			return nil, s.connErr
		}
		return s.session, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// connect opens a new session and prepares the schema.
func (s *Store) connect() (*gocql.Session, error) {
	cluster := gocql.NewCluster(s.cfg.CassandraHosts...)
	cluster.Port = s.cfg.CassandraPort
	cluster.Consistency = gocql.ParseConsistency(s.cfg.CassandraConsistency)
	cluster.Timeout = s.cfg.CassandraTimeout
	cluster.ConnectTimeout = s.cfg.CassandraConnTimeout
	cluster.ReconnectInterval = 5 * time.Second
	if s.cfg.CassandraUsername != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{
			Username: s.cfg.CassandraUsername,
			Password: s.cfg.CassandraPassword,
		}
	}

	session, err := cluster.CreateSession()
	if err != nil {
		return nil, err
	}
	if err := s.ensureSchema(context.Background(), session); err != nil {
		session.Close()
		return nil, err
	}

	log.Printf("connected to Cassandra, keyspace %q ready", s.cfg.CassandraKeyspace)
	return session, nil
}

// ensureSchema creates the keyspace and table. Both statements are idempotent.
func (s *Store) ensureSchema(ctx context.Context, session *gocql.Session) error {
	// Identifiers cannot be bound as query parameters; the keyspace name is validated in New.
	statements := []string{
		fmt.Sprintf(`CREATE KEYSPACE IF NOT EXISTS %s
			WITH replication = {'class': 'SimpleStrategy', 'replication_factor': %d}`,
			s.cfg.CassandraKeyspace, s.cfg.CassandraReplication),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.health_records (
			id timeuuid PRIMARY KEY,
			created_at timestamp
		)`, s.cfg.CassandraKeyspace),
	}
	for _, stmt := range statements {
		// Schema changes wait for agreement between nodes, so allow more than a normal query.
		schemaCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		err := session.Query(stmt).ExecContext(schemaCtx)
		cancel()
		if err != nil {
			return fmt.Errorf("prepare schema: %w", err)
		}
	}
	return nil
}

// dropSession closes the given session so the next call reconnects. It leaves a newer
// session alone if another request has already reconnected.
func (s *Store) dropSession(session *gocql.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.session == session && session != nil {
		session.Close()
		s.session = nil
	}
}

// Ping runs a lightweight read from the system tables and checks the application table
// exists. It never writes data.
func (s *Store) Ping(ctx context.Context) error {
	session, err := s.getSession(ctx)
	if err != nil {
		return err
	}

	var version string
	if err := session.Query(`SELECT release_version FROM system.local`).ScanContext(ctx, &version); err != nil {
		s.dropSession(session)
		return err
	}

	tableQuery := fmt.Sprintf(`SELECT id FROM %s.health_records LIMIT 1`, s.cfg.CassandraKeyspace)
	var id gocql.UUID
	if err := session.Query(tableQuery).ScanContext(ctx, &id); err != nil && !errors.Is(err, gocql.ErrNotFound) {
		s.dropSession(session)
		return err
	}
	return nil
}

// InsertRecord stores a new HealthRecord and returns it.
func (s *Store) InsertRecord(ctx context.Context) (models.HealthRecord, error) {
	session, err := s.getSession(ctx)
	if err != nil {
		return models.HealthRecord{}, err
	}

	record := models.HealthRecord{
		ID:        gocql.TimeUUID(),
		CreatedAt: time.Now().UTC().Truncate(time.Millisecond), // Cassandra stores milliseconds
	}
	stmt := fmt.Sprintf(`INSERT INTO %s.health_records (id, created_at) VALUES (?, ?)`, s.cfg.CassandraKeyspace)
	if err := session.Query(stmt, record.ID, record.CreatedAt).ExecContext(ctx); err != nil {
		return models.HealthRecord{}, err
	}
	return record, nil
}

// GetRecord reads a HealthRecord by ID. It returns gocql.ErrNotFound if there is no such row.
func (s *Store) GetRecord(ctx context.Context, id gocql.UUID) (models.HealthRecord, error) {
	session, err := s.getSession(ctx)
	if err != nil {
		return models.HealthRecord{}, err
	}

	record := models.HealthRecord{}
	stmt := fmt.Sprintf(`SELECT id, created_at FROM %s.health_records WHERE id = ?`, s.cfg.CassandraKeyspace)
	err = session.Query(stmt, id).ScanContext(ctx, &record.ID, &record.CreatedAt)
	return record, err
}

// DeleteRecord removes a HealthRecord by ID.
func (s *Store) DeleteRecord(ctx context.Context, id gocql.UUID) error {
	session, err := s.getSession(ctx)
	if err != nil {
		return err
	}
	stmt := fmt.Sprintf(`DELETE FROM %s.health_records WHERE id = ?`, s.cfg.CassandraKeyspace)
	return session.Query(stmt, id).ExecContext(ctx)
}

// Close releases the session, if any.
func (s *Store) Close() {
	s.mu.Lock()
	session := s.session
	s.mu.Unlock()
	s.dropSession(session)
}
