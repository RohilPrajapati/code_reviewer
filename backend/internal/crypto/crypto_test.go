package crypto

import (
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := "test-secret-key-32-chars-long1234"
	plaintext := "ghp_1234567890abcdefghijklmnopqrstuvwxyz"

	encrypted, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if encrypted == plaintext {
		t.Fatalf("Ciphertext should not equal plaintext")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != plaintext {
		t.Fatalf("Expected decrypted text %q, got %q", plaintext, decrypted)
	}
}

func TestMaskToken(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"short", "••••••••"},
		{"ghp_12345678", "ghp...678"},
		{"ghp_1234567890abcdef", "ghp_...cdef"},
		{"AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz", "AIza...WxYz"},
	}

	for _, tt := range tests {
		got := MaskToken(tt.input)
		if got != tt.expected {
			t.Errorf("MaskToken(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}
