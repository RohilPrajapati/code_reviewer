package config

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
)

type Config struct {
	Port          string
	DBPath        string
	EncryptionKey string
	CORSOrigin    string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./reviewer.db"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if encryptionKey == "" {
		log.Println("[WARN] ENCRYPTION_KEY not set in environment. Generating a temporary 32-byte key for this session.")
		tempKey := make([]byte, 32)
		if _, err := rand.Read(tempKey); err != nil {
			log.Fatalf("Failed to generate random key: %v", err)
		}
		encryptionKey = hex.EncodeToString(tempKey)
	}

	return &Config{
		Port:          port,
		DBPath:        dbPath,
		EncryptionKey: encryptionKey,
		CORSOrigin:    corsOrigin,
	}
}
