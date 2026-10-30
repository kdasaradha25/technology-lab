// Package models defines the data stored in Cassandra.
package models

import (
	"time"

	gocql "github.com/apache/cassandra-gocql-driver/v2"
)

// HealthRecord is a row in the health_records table.
//
// The partition key is ID, a time-based UUID: every record gets its own partition, so
// writes spread evenly across nodes and a record is read back directly by its key.
type HealthRecord struct {
	ID        gocql.UUID `json:"id"`
	CreatedAt time.Time  `json:"created_at"`
}
