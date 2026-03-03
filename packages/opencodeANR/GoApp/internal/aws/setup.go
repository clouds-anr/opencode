package aws

import (
	"context"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
)

// SetupCredentials loads AWS config for a given profile.
func SetupCredentials(ctx context.Context, profile string) error {
	if profile == "" {
		return nil
	}
	_, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithSharedConfigProfile(profile))
	if err != nil {
		return fmt.Errorf("load AWS config for profile %s: %w", profile, err)
	}
	return nil
}
