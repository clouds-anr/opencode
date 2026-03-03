package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
)

// AuditEventType represents the type of audit event.
type AuditEventType string

const (
	EventAuthLogin         AuditEventType = "auth.login"
	EventAuthLogout        AuditEventType = "auth.logout"
	EventAuthTokenRefresh  AuditEventType = "auth.token_refresh"
	EventAuthFailed        AuditEventType = "auth.failed"
	EventQuotaCheck        AuditEventType = "quota.check"
	EventQuotaExceeded     AuditEventType = "quota.exceeded"
	EventAPICall           AuditEventType = "api.call"
	EventConfigChange      AuditEventType = "config.change"
	EventHealthCheck       AuditEventType = "health.check"
	EventSecurityIncident  AuditEventType = "security.incident"
)

// AuditEvent represents an audit log entry.
type AuditEvent struct {
	UserID      string         `json:"user_id"`
	EventType   AuditEventType `json:"event_type"`
	Timestamp   time.Time      `json:"timestamp"`
	IPAddress   string         `json:"ip_address,omitempty"`
	UserAgent   string         `json:"user_agent,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Success     bool           `json:"success"`
	ErrorMsg    string         `json:"error_msg,omitempty"`
}

// LogAuditEvent logs an audit event to DynamoDB.
func LogAuditEvent(ctx context.Context, cfg *config.ProfileConfig, event *AuditEvent) error {
	if cfg.AuditTableName == "" {
		// Audit logging not configured
		logging.Debug("audit event not logged: AuditTableName not configured", "event", event.EventType)
		return nil
	}

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	// Convert to DynamoDB item
	item := map[string]types.AttributeValue{
		"user_id":    &types.AttributeValueMemberS{Value: event.UserID},
		"timestamp":  &types.AttributeValueMemberS{Value: event.Timestamp.Format(time.RFC3339)},
		"event_type": &types.AttributeValueMemberS{Value: string(event.EventType)},
		"success":    &types.AttributeValueMemberBOOL{Value: event.Success},
	}

	if event.IPAddress != "" {
		item["ip_address"] = &types.AttributeValueMemberS{Value: event.IPAddress}
	}
	if event.UserAgent != "" {
		item["user_agent"] = &types.AttributeValueMemberS{Value: event.UserAgent}
	}
	if event.ErrorMsg != "" {
		item["error_msg"] = &types.AttributeValueMemberS{Value: event.ErrorMsg}
	}
	if len(event.Details) > 0 {
		detailsJSON, _ := json.Marshal(event.Details)
		item["details"] = &types.AttributeValueMemberS{Value: string(detailsJSON)}
	}

	// Get DynamoDB client
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		logging.Warn("failed to load AWS config for audit logging", "error", err, "event", event.EventType)
		return err
	}

	client := dynamodb.NewFromConfig(awsCfg)

	// Put item to DynamoDB
	_, err = client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(cfg.AuditTableName),
		Item:      item,
	})

	if err != nil {
		logging.Warn("failed to write audit event to DynamoDB", "error", err, "event", event.EventType, "table", cfg.AuditTableName)
		return err
	}

	logging.Debug("audit event logged",
		"user", event.UserID,
		"type", event.EventType,
		"success", event.Success)

	return nil
}

// Helper functions for common audit events

// LogAuthEvent logs authentication-related events.
func LogAuthEvent(ctx context.Context, cfg *config.ProfileConfig, userID string, eventType AuditEventType, success bool, details map[string]interface{}, err error) error {
	event := &AuditEvent{
		UserID:    userID,
		EventType: eventType,
		Success:   success,
		Details:   details,
	}
	if err != nil {
		event.ErrorMsg = err.Error()
	}
	return LogAuditEvent(ctx, cfg, event)
}

// LogQuotaEvent logs quota-related events.
func LogQuotaEvent(ctx context.Context, cfg *config.ProfileConfig, userID string, allowed bool, usage map[string]interface{}) error {
	eventType := EventQuotaCheck
	if !allowed {
		eventType = EventQuotaExceeded
	}

	event := &AuditEvent{
		UserID:    userID,
		EventType: eventType,
		Success:   allowed,
		Details:   map[string]interface{}{"usage": usage},
	}
	return LogAuditEvent(ctx, cfg, event)
}

// LogAPIEvent logs API call events.
func LogAPIEvent(ctx context.Context, cfg *config.ProfileConfig, userID, apiName, method, endpoint string, statusCode int, err error) error {
	event := &AuditEvent{
		UserID:    userID,
		EventType: EventAPICall,
		Success:   err == nil && statusCode < 400,
		Details: map[string]interface{}{
			"api":        apiName,
			"method":     method,
			"endpoint":   endpoint,
			"status_code": statusCode,
		},
	}
	if err != nil {
		event.ErrorMsg = err.Error()
	}
	return LogAuditEvent(ctx, cfg, event)
}