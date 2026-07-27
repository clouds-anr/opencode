#!/usr/bin/env bun
/**
 * Validate ANRCODE_CHANGE marker compliance for specified files.
 *
 * Usage:
 *   bun run validate-marker-compliance.ts file1.ts file2.ts ...
 *   git diff --name-only origin/dev...HEAD | xargs bun run validate-marker-compliance.ts
 *
 * Reads from stdin if no arguments provided (one file path per line).
 * Exits with code 0 if all files PASS or WARN, exits with code 1 if any file FAIL.
 */

import { readFileSync, existsSync } from "fs";

interface ValidationResult {
  file: string;
  status: "PASS" | "FAIL" | "WARN";
  reason?: string;
}

const EXEMPT_PATTERNS = [
  /^packages\/anr-core\//,
  /^src\/generated\//,
  /^src\/generated-effect\//,
  /\.lock$/,
  /bun\.lockb$/,
];

const MARKER_REGEX = /ANRCODE_CHANGE\s*\{([^}]+)\}/;

interface MarkerData {
  issue?: string | number;
  branch?: string;
  date?: string;
}

function isExempt(filePath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(filePath));
}

function validateMarker(markerJson: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const data = JSON.parse(markerJson) as MarkerData;

    // Validate issue field
    if (data.issue === undefined) {
      errors.push("missing 'issue' field");
    } else if (typeof data.issue === "string") {
      errors.push(
        `'issue' must be numeric (got string: "${data.issue}") — use numeric GitHub issue ID`
      );
    } else if (typeof data.issue !== "number") {
      errors.push(`'issue' must be a number (got ${typeof data.issue})`);
    }

    // Validate branch field
    if (!data.branch || typeof data.branch !== "string") {
      errors.push("'branch' must be a non-empty string");
    }

    // Validate date field
    if (!data.date || typeof data.date !== "string") {
      errors.push("'date' must be a non-empty string");
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      errors.push(`'date' must be in YYYY-MM-DD format (got "${data.date}")`);
    }
  } catch (e) {
    errors.push(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateFile(filePath: string): ValidationResult {
  // Skip exempt paths
  if (isExempt(filePath)) {
    return {
      file: filePath,
      status: "PASS",
      reason: "exempt path",
    };
  }

  // Skip if file doesn't exist
  if (!existsSync(filePath)) {
    return {
      file: filePath,
      status: "PASS",
      reason: "file not found (may have been deleted)",
    };
  }

  // Read file content
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    return {
      file: filePath,
      status: "FAIL",
      reason: `failed to read file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Check for marker
  const match = content.match(MARKER_REGEX);
  if (!match) {
    return {
      file: filePath,
      status: "FAIL",
      reason: "missing ANRCODE_CHANGE marker",
    };
  }

  // Validate marker JSON
  const markerJson = match[1];
  const validation = validateMarker(markerJson);

  if (!validation.valid) {
    return {
      file: filePath,
      status: "WARN",
      reason: `malformed marker: ${validation.errors.join("; ")}`,
    };
  }

  return {
    file: filePath,
    status: "PASS",
    reason: "valid marker",
  };
}

async function readStdin(): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of console) {
    const trimmed = line.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }
  return lines;
}

async function main(): Promise<void> {
  let filePaths: string[] = process.argv.slice(2);

  // If no arguments, read from stdin
  if (filePaths.length === 0) {
    try {
      filePaths = await readStdin();
    } catch {
      // stdin not available or error reading
      filePaths = [];
    }
  }

  if (filePaths.length === 0) {
    console.log("No files to validate.");
    process.exit(0);
  }

  const results: ValidationResult[] = [];
  let hasFailures = false;

  for (const filePath of filePaths) {
    const result = validateFile(filePath);
    results.push(result);
    if (result.status === "FAIL") {
      hasFailures = true;
    }
  }

  // Print summary table
  console.log("\n=== ANRCODE_CHANGE Marker Compliance ===\n");
  console.log("File | Status | Reason");
  console.log("-----|--------|-------");

  for (const result of results) {
    const status = result.status;
    const reason = result.reason || "";
    console.log(`${result.file} | ${status} | ${reason}`);
  }

  // Print summary counts
  const passCount = results.filter((r) => r.status === "PASS").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;

  console.log("\n=== Summary ===");
  console.log(`PASS: ${passCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);

  // Exit with appropriate code
  if (hasFailures) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
