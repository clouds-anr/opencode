package config

import "os"

// RuntimeEnv captures environment overrides from the shell.
type RuntimeEnv struct {
	AWSProfile   string
	OTELEndpoint string
	ClaudePath   string
	CCWBProfile  string
	Debug        bool
}

// LoadRuntimeEnv reads relevant environment variables.
func LoadRuntimeEnv() RuntimeEnv {
	debug := os.Getenv("COGNITO_AUTH_DEBUG")
	return RuntimeEnv{
		AWSProfile:   os.Getenv("AWS_PROFILE"),
		OTELEndpoint: os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		ClaudePath:   os.Getenv("CLAUDE_PATH"),
		CCWBProfile:  os.Getenv("CCWB_PROFILE"),
		Debug:        debug == "1" || debug == "true" || debug == "yes",
	}
}
