package auth

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
)

// DecodeJWTPayload decodes the payload of a JWT without signature verification.
func DecodeJWTPayload(token string) (map[string]interface{}, error) {
	parts := strings.SplitN(token, ".", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT: expected 3 parts, got %d", len(parts))
	}

	payload := parts[1]
	// Add padding
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		// Try with RawURLEncoding
		decoded, err = base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, fmt.Errorf("decode JWT payload: %w", err)
		}
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return nil, fmt.Errorf("parse JWT claims: %w", err)
	}
	return claims, nil
}

// ExtractEmail extracts email from JWT claims, checking common claim names.
func ExtractEmail(claims map[string]interface{}) string {
	for _, key := range []string{"email", "preferred_username", "mail"} {
		if v, ok := claims[key].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

// ExtractGroups extracts group memberships from JWT claims.
func ExtractGroups(claims map[string]interface{}) []string {
	var groups []string
	for _, key := range []string{"groups", "cognito:groups"} {
		if v, ok := claims[key]; ok {
			switch val := v.(type) {
			case []interface{}:
				for _, g := range val {
					if s, ok := g.(string); ok {
						groups = append(groups, s)
					}
				}
			case string:
				groups = append(groups, val)
			}
		}
	}
	if dept, ok := claims["custom:department"].(string); ok && dept != "" {
		groups = append(groups, "department:"+dept)
	}
	// Deduplicate
	seen := make(map[string]bool)
	unique := groups[:0]
	for _, g := range groups {
		if !seen[g] {
			seen[g] = true
			unique = append(unique, g)
		}
	}
	return unique
}
