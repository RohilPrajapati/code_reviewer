package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
)

// DeriveKey ensures we always have a 32-byte AES-256 key from a passphrase or hex string.
func DeriveKey(keyStr string) []byte {
	// If hex string of length 64, decode it
	if len(keyStr) == 64 {
		if decoded, err := hex.DecodeString(keyStr); err == nil && len(decoded) == 32 {
			return decoded
		}
	}
	// Otherwise hash the key string with SHA-256 to get 32 bytes
	h := sha256.Sum256([]byte(keyStr))
	return h[:]
}

// Encrypt encrypts plaintext using AES-GCM with the provided key string.
func Encrypt(plaintext, keyStr string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key := DeriveKey(keyStr)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext using AES-GCM with the provided key string.
func Decrypt(encryptedBase64, keyStr string) (string, error) {
	if encryptedBase64 == "" {
		return "", nil
	}
	key := DeriveKey(keyStr)
	data, err := base64.StdEncoding.DecodeString(encryptedBase64)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// MaskToken produces a safe preview of a secret token (e.g., "AIza...1234").
func MaskToken(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	if len(token) <= 8 {
		return "••••••••"
	}
	if len(token) <= 12 {
		return token[:3] + "..." + token[len(token)-3:]
	}
	return token[:4] + "..." + token[len(token)-4:]
}
