package main

import (
	"context"
	"fmt"
	"os"

	"github.com/clouds-anr/GovClaudeClient/internal/audit"
	"github.com/clouds-anr/GovClaudeClient/internal/auth"
	"github.com/clouds-anr/GovClaudeClient/internal/aws"
	"github.com/clouds-anr/GovClaudeClient/internal/config"
	"github.com/clouds-anr/GovClaudeClient/internal/health"
	"github.com/clouds-anr/GovClaudeClient/internal/logging"
	"github.com/clouds-anr/GovClaudeClient/internal/otelhelper"
	"github.com/clouds-anr/GovClaudeClient/internal/proxy"
	"github.com/clouds-anr/GovClaudeClient/internal/ui"
	"github.com/clouds-anr/GovClaudeClient/internal/version"
	"github.com/spf13/cobra"
)

func main() {
	var (
		envFile           string
		profile           string
		credentialProcess bool
		getOtelHeaders    bool
		otelStatsHook     bool
		clearCache        bool
		checkExpiration   bool
		setup             bool
		status            bool
		quota             bool
		quotaHook         bool
		installHooks      bool
		showVersion       bool
		claudePath        string
		bedrock           bool
		verbose           bool
		logFile           string
	)

	rootCmd := &cobra.Command{
		Use:   "claude-bedrock",
		Short: "Claude Code launcher with AWS Bedrock, OIDC auth, OTEL, and PTY proxy",
		Long: `Claude Code with Bedrock — launcher, credential process, and OTEL helper.

A single binary that handles authentication, credential management,
telemetry, quota monitoring, and launching Claude Code with Bedrock.`,
		SilenceUsage:  true,
		SilenceErrors: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			// --- OTEL headers mode (fast path) ---
			// Runs before ANY other initialization to minimize latency.
			// Claude Code calls this on every telemetry export; it must be
			// fast, always succeed, and always output valid JSON to stdout.
			if getOtelHeaders {
				// Enable file logging for OTEL headers debugging if --log-file is provided
				// This won't pollute stdout since we only write to a log file
				logPath := logFile
				if logPath != "" {
					logging.Setup(false, logPath)
					defer logging.Close()
				}

				// Ensure we ALWAYS output valid JSON, even if there's a panic
				defer func() {
					if r := recover(); r != nil {
						logging.Debug("PANIC in OTEL headers helper", "recovered", r)
						_, _ = os.Stdout.WriteString("{}\n")
					}
				}()
				p := profile
				if p == "" {
					p = os.Getenv("CCWB_PROFILE")
				}
				logging.Debug("OTEL headers profile resolved", "profile", p)
				_ = otelhelper.RunOTELHeadersByProfile(p)
				logging.Debug("OTEL headers helper completed successfully")
				return nil // Always exit 0
			}

			// Silent modes: don't pollute stdout with log output
			silentMode := credentialProcess || quotaHook || otelStatsHook

			// Set up logging early
			if !silentMode {
				logging.Setup(verbose, logFile)
			} else if logFile != "" {
				// Even in silent mode, allow file logging
				logging.Setup(false, logFile)
			} else {
				logging.Setup(false, "")
			}
			defer logging.Close()

			logging.Debug("claude-bedrock starting",
				"version", version.Version,
				"args", os.Args,
			)

			// Ensure critical system directories are in PATH (Windows Sandbox fix).
			health.EnsureSystemPATH()

			// Load configuration
			cfg, err := config.Load(envFile)
			if err != nil {
				return fmt.Errorf("config: %w", err)
			}

			// Override profile from flag or env
			if profile != "" {
				cfg.Profile.ProfileName = profile
			}
			if cfg.Profile.ProfileName == "" {
				if envProfile := os.Getenv("CCWB_PROFILE"); envProfile != "" {
					cfg.Profile.ProfileName = envProfile
				}
			}

			logging.Debug("configuration loaded",
				"profile", cfg.Profile.ProfileName,
				"provider", cfg.Profile.ProviderType,
				"region", cfg.Profile.AWSRegion,
				"federation", cfg.Profile.FederationType,
			)

			// --- Version ---
			if showVersion {
				health.PrintVersionInfo(version.Version)
				return nil
			}

			// --- Credential-process mode ---
			if credentialProcess {
				logging.Debug("entering credential-process mode")
				return aws.RunCredentialProcess(cfg)
			}

			// --- OTEL stats hook mode ---
			if otelStatsHook {
				logging.Debug("entering otel-stats-hook mode")
				return otelhelper.RunOTELStatsHook(cfg)
			}

			// --- Quota hook mode (enhanced with 80/90/100% warnings) ---
			if quotaHook {
				logging.Debug("entering quota-hook mode")
				exitCode := aws.RunQuotaHook(cfg)
				if exitCode != 0 {
					os.Exit(exitCode)
				}
				return nil
			}

			// --- Clear cache ---
			if clearCache {
				logging.Info("clearing cached credentials", "profile", cfg.Profile.ProfileName)
				cleared := aws.ClearCachedCredentials(&cfg.Profile)
				if len(cleared) > 0 {
					fmt.Fprintf(os.Stderr, "Cleared cached credentials for profile '%s':\n", cfg.Profile.ProfileName)
					for _, item := range cleared {
						fmt.Fprintf(os.Stderr, "  - %s\n", item)
					}
				} else {
					fmt.Fprintf(os.Stderr, "No cached credentials found for profile '%s'\n", cfg.Profile.ProfileName)
				}
				return nil
			}

			// --- Check expiration ---
			if checkExpiration {
				if aws.CheckCredentialsExpired(&cfg.Profile) {
					fmt.Fprintln(os.Stderr, "Credentials expired or missing.")
					os.Exit(1)
				}
				fmt.Fprintln(os.Stderr, "Credentials valid.")
				return nil
			}

			// --- Health/Status check ---
			if status {
				if !health.RunHealthCheck(cfg) {
					os.Exit(1)
				}
				return nil
			}

			// --- Quota check ---
			if quota {
				return runQuotaCheck(cfg)
			}

			// --- Install hooks ---
			if installHooks {
				return config.InstallQuotaHooks(cfg)
			}

			// --- Setup mode ---
			if setup {
				return runSetup(cfg)
			}

			// --- Default: launcher mode ---
			return runLauncher(cfg, claudePath, bedrock, args)
		},
	}

	f := rootCmd.Flags()
	f.StringVarP(&envFile, "env-file", "e", "", "Path to env file (default: auto-detect env.* next to binary or in cwd)")
	f.StringVarP(&profile, "profile", "p", "", "Configuration profile to use")
	f.BoolVar(&credentialProcess, "credential-process", false, "Run as AWS credential process (output JSON credentials)")
	f.BoolVar(&getOtelHeaders, "get-otel-headers", false, "Output OTEL headers as JSON")
	f.BoolVar(&otelStatsHook, "otel-stats-hook", false, "Run as Claude Code hook for OTEL telemetry")
	f.BoolVar(&clearCache, "clear-cache", false, "Clear cached credentials")
	f.BoolVar(&checkExpiration, "check-expiration", false, "Check credential expiration (exit 0=valid, 1=expired)")
	f.BoolVar(&setup, "setup", false, "Force re-run of setup")
	f.BoolVar(&status, "status", false, "Run connectivity diagnostics")
	f.BoolVar(&quota, "quota", false, "Check user's token quota usage")
	f.BoolVar(&quotaHook, "quota-hook", false, "Run as Claude Code hook for quota checking")
	f.BoolVar(&installHooks, "install-hooks", false, "Install Claude Code hooks for quota and OTEL")
	f.BoolVar(&showVersion, "version", false, "Show version information")
	f.StringVar(&claudePath, "claude-path", "", "Path to Claude CLI binary")
	f.BoolVar(&bedrock, "bedrock", true, "Use AWS Bedrock (default)")
	f.BoolVar(&verbose, "verbose", false, "Enable verbose debug logging to stderr")
	f.StringVar(&logFile, "log-file", "", "Log to file (use 'default' for platform default path)")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// runSetup writes Claude settings, AWS config, and installs hooks.
func runSetup(cfg *config.AppConfig) error {
	ui.Banner("Setup — Claude Code with Bedrock")
	logging.Info("running setup", "profile", cfg.Profile.ProfileName)

	if err := config.WriteAWSConfig(cfg); err != nil {
		return fmt.Errorf("write AWS config: %w", err)
	}
	ui.Success("AWS profile configured")
	logging.Debug("wrote AWS config")

	if err := config.WriteClaudeSettings(cfg); err != nil {
		return fmt.Errorf("write Claude settings: %w", err)
	}
	ui.Success("Claude Code settings written (env, OTEL, credentials)")
	logging.Debug("wrote Claude settings")

	if err := config.InstallQuotaHooks(cfg); err != nil {
		ui.Warn(fmt.Sprintf("Could not install quota hooks: %v", err))
		logging.Warn("quota hooks install failed", "error", err)
	} else {
		ui.Success("Quota hooks installed (80%/90%/100% enforcement)")
	}

	ui.Complete("Setup complete")
	logging.Info("setup complete")
	return nil
}

// runLauncher is the default mode: check deps, authenticate, setup if needed, launch claude.
func runLauncher(cfg *config.AppConfig, claudePath string, useBedrock bool, extraArgs []string) error {
	ui.Banner("Claude Code with Bedrock")
	logging.Info("launcher starting", "profile", cfg.Profile.ProfileName)

	totalSteps := 4

	// --- Step 1: Dependency check and auto-install ---
	ui.Step(1, totalSteps, "Checking dependencies...")
	logging.Debug("checking dependencies")
	deps := health.DefaultDependencies()
	urlOverrides := health.InstallerURLOverrides{}
	if cfg.Profile.InstallerURLClaude != "" {
		urlOverrides["claude"] = cfg.Profile.InstallerURLClaude
	}
	if cfg.Profile.InstallerURLGit != "" {
		urlOverrides["git"] = cfg.Profile.InstallerURLGit
	}
	results, allRequired := health.EnsureDependencies(deps, urlOverrides)

	if !allRequired {
		logging.Error("required dependencies still missing after install attempts")
		ui.Error("Required dependencies are missing and could not be installed automatically")
		return fmt.Errorf("required dependencies are missing and could not be installed automatically")
	}

	// Resolve Claude binary path
	claudeBin := claudePath
	if claudeBin == "" {
		for _, r := range results {
			if r.Dep.Binary == "claude" && r.Found {
				claudeBin = r.Path
				break
			}
		}
	}
	if claudeBin == "" {
		return fmt.Errorf("could not find 'claude' binary in PATH; install it from https://docs.anthropic.com/en/docs/claude-code/getting-started")
	}
	logging.Debug("using claude binary", "path", claudeBin)

	// --- Step 2: Setup ---
	ui.Step(2, totalSteps, "Configuring...")
	logging.Debug("writing config files")
	if err := config.WriteAWSConfig(cfg); err != nil {
		ui.Warn(fmt.Sprintf("Could not write AWS config: %v", err))
		logging.Warn("AWS config write failed", "error", err)
	} else {
		ui.Success("AWS profile configured")
	}
	if err := config.WriteClaudeSettings(cfg); err != nil {
		ui.Warn(fmt.Sprintf("Could not write Claude settings: %v", err))
		logging.Warn("Claude settings write failed", "error", err)
	} else {
		ui.Success("Claude Code settings written")
	}

	// --- Step 3: Authenticate ---
	ui.Step(3, totalSteps, "Authenticating...")
	logging.Debug("checking cached credentials")
	cached, err := aws.GetCachedCredentials(&cfg.Profile)
	if err == nil && cached != nil {
		ui.Success(fmt.Sprintf("Using cached credentials (expires %s)", cached.Expiration))
		logging.Debug("using cached credentials", "expires", cached.Expiration)
	} else {
		ui.Progress("Opening browser for authentication...")
		logging.Info("starting OIDC authentication")
		tokens, err := auth.AuthenticateOIDC(context.Background(), &cfg.Profile)
		if err != nil {
			logging.Error("OIDC authentication failed", "error", err)
			ui.Fail("Authentication failed")
			return fmt.Errorf("authentication failed: %w", err)
		}
		logging.Debug("OIDC authentication successful")

		creds, err := aws.GetAWSCredentials(&cfg.Profile, tokens.IDToken, tokens.Claims)
		if err != nil {
			logging.Error("credential exchange failed", "error", err)
			ui.Fail("Credential exchange failed")
			return fmt.Errorf("credential exchange failed: %w", err)
		}
		logging.Debug("AWS credentials obtained", "expires", creds.Expiration)

		if err := aws.SaveCredentials(&cfg.Profile, creds); err != nil {
			ui.Warn(fmt.Sprintf("Could not cache credentials: %v", err))
			logging.Warn("credential cache failed", "error", err)
		}
		_ = aws.SaveMonitoringToken(&cfg.Profile, tokens.IDToken, tokens.Claims)

		// Audit successful authentication (now that we have valid AWS credentials)
		userID := "unknown"
		if sub, ok := tokens.Claims["sub"].(string); ok {
			userID = sub
		}
		_ = audit.LogAuthEvent(context.Background(), &cfg.Profile, userID, audit.EventAuthLogin, true, map[string]interface{}{
			"provider": cfg.Profile.ProviderType,
			"domain":   cfg.Profile.ProviderDomain,
		}, nil)

		ui.Success("Authenticated successfully")
	}

	// --- Step 4: Launch ---
	profile := cfg.Profile.ProfileName
	if useBedrock {
		ui.Step(4, totalSteps, fmt.Sprintf("Launching Claude Code (profile: %s)...", profile))
	} else {
		ui.Step(4, totalSteps, "Launching Claude Code with Anthropic API...")
	}
	logging.Info("launching claude", "bedrock", useBedrock, "profile", profile)

	env := os.Environ()
	if useBedrock {
		env = append(env, "AWS_PROFILE="+profile, "CLAUDE_CODE_USE_BEDROCK=1")
	}

	ctx := context.Background()
	return proxy.Run(ctx, claudeBin, extraArgs, env)
}

// runQuotaCheck performs an interactive quota check and displays results.
func runQuotaCheck(cfg *config.AppConfig) error {
	logging.Debug("running quota check")

	// Get user email from monitoring token
	token := aws.GetMonitoringToken(&cfg.Profile)
	if token == "" {
		return fmt.Errorf("no cached authentication token; run launcher first")
	}

	claims, err := auth.DecodeJWTPayload(token)
	if err != nil {
		return fmt.Errorf("decode token: %w", err)
	}
	email := auth.ExtractEmail(claims)
	if email == "" {
		return fmt.Errorf("no email in token claims")
	}
	logging.Debug("quota check for user", "email", email)

	ctx := context.Background()
	display, err := aws.CheckQuotaDynamo(ctx, cfg.Profile.ProfileName, cfg.Profile.AWSRegion, email)
	if err != nil {
		return fmt.Errorf("quota check failed: %w", err)
	}

	aws.PrintQuota(display)
	return nil
}
