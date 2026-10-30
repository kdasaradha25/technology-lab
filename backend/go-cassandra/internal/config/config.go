// Package config reads application settings from environment variables.
package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds every setting the application needs.
type Config struct {
	Port           string
	AllowedOrigins []string

	CassandraHosts       []string
	CassandraPort        int
	CassandraKeyspace    string
	CassandraUsername    string
	CassandraPassword    string
	CassandraConsistency string
	CassandraReplication int
	CassandraTimeout     time.Duration
	CassandraConnTimeout time.Duration
}

// Load reads configuration from the environment, after applying values from a .env
// file in the working directory (if present). Real environment variables win.
func Load() Config {
	LoadDotEnv(".env")

	return Config{
		Port:           getEnv("PORT", "8004"),
		AllowedOrigins: splitList(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:4200")),

		CassandraHosts:       splitList(getEnv("CASSANDRA_HOSTS", "127.0.0.1")),
		CassandraPort:        getInt("CASSANDRA_PORT", 9042),
		CassandraKeyspace:    getEnv("CASSANDRA_KEYSPACE", "technology_lab"),
		CassandraUsername:    os.Getenv("CASSANDRA_USERNAME"),
		CassandraPassword:    os.Getenv("CASSANDRA_PASSWORD"),
		CassandraConsistency: getEnv("CASSANDRA_CONSISTENCY", "LOCAL_ONE"),
		CassandraReplication: getInt("CASSANDRA_REPLICATION_FACTOR", 1),
		CassandraTimeout:     getDuration("CASSANDRA_TIMEOUT", 3*time.Second),
		CassandraConnTimeout: getDuration("CASSANDRA_CONNECT_TIMEOUT", 5*time.Second),
	}
}

// LoadDotEnv sets KEY=VALUE pairs from the given file without overriding variables
// that are already set. A missing file is not an error.
func LoadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, strings.Trim(strings.TrimSpace(value), `"'`))
		}
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if value, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return value
	}
	return fallback
}

// getDuration accepts Go durations ("3s", "500ms") or a plain number of seconds.
func getDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if d, err := time.ParseDuration(value); err == nil {
		return d
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}

func splitList(value string) []string {
	var items []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}
