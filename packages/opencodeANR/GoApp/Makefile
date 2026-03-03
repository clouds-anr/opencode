.PHONY: build test lint clean install cross release help

# Binary name
BINARY=claude-bedrock
VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS=-ldflags "-X github.com/clouds-anr/GovClaudeClient/internal/version.Version=$(VERSION)"

# Default target
all: build

## build: Build the binary for the current platform
build:
	@echo "Building $(BINARY)..."
	@mkdir -p dist
	go build $(LDFLAGS) -o dist/$(BINARY) ./cmd/main.go

## test: Run all tests
test:
	@echo "Running tests..."
	go test -v ./...

## test-coverage: Run tests with coverage report
test-coverage:
	@echo "Running tests with coverage..."
	@mkdir -p dist
	go test -v -coverprofile=dist/coverage.out ./...
	go tool cover -html=dist/coverage.out -o dist/coverage.html
	@echo "Coverage report: dist/coverage.html"

## lint: Run linters (vet and staticcheck if installed)
lint:
	@echo "Running go vet..."
	go vet ./...
	@if command -v staticcheck >/dev/null 2>&1; then \
		echo "Running staticcheck..."; \
		staticcheck ./...; \
	fi

## fmt: Format all Go files
fmt:
	@echo "Formatting code..."
	go fmt ./...

## clean: Remove build artifacts
clean:
	@echo "Cleaning..."
	rm -rf dist

## install: Install the binary to $GOPATH/bin
	@echo "Installing $(BINARY)..."
	go install $(LDFLAGS) ./cmd/main.go

## cross: Build for all platforms
	@echo "Cross-compiling..."
	@mkdir -p dist
	GOOS=linux   GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-linux-amd64   ./cmd/main.go
	GOOS=linux   GOARCH=arm64 go build $(LDFLAGS) -o dist/$(BINARY)-linux-arm64   ./cmd/main.go
	GOOS=darwin  GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-darwin-amd64  ./cmd/main.go
	GOOS=darwin  GOARCH=arm64 go build $(LDFLAGS) -o dist/$(BINARY)-darwin-arm64  ./cmd/main.go
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o dist/$(BINARY)-windows-amd64.exe ./cmd/main.go
	@echo "Cross-compilation complete"

## release: Create a release using goreleaser
release:
	@if ! command -v goreleaser >/dev/null 2>&1; then \
		echo "Error: goreleaser not installed. Install with: go install github.com/goreleaser/goreleaser@latest"; \
		exit 1; \
	fi
	@echo "Running goreleaser..."
	goreleaser release --clean

## deps: Download dependencies
deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

## help: Show this help message
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/ /'
