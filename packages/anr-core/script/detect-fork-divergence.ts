#!/usr/bin/env bun
/**
 * Detect fork divergence from upstream and report marker compliance.
 *
 * Usage:
 *   bun run detect-fork-divergence.ts
 *
 * Outputs JSON to stdout with fork divergence summary and marker status.
 */

import { spawnSync } from "bun";
import { readFileSync } from "fs";
import { existsSync } from "fs";

interface DivergenceReport {
  generatedAt: string;
  upstreamRemote: string;
  upstreamBranch: string;
  forkBranch: string;
  summary: {
    totalDivergedFiles: number;
    markedFiles: number;
    unmarkedFiles: number;
    exemptFiles: number;
    // ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-23"}
    anrOwnedFiles: number;
  };
  markedFiles: string[];
  unmarkedFiles: string[];
  exemptFiles: string[];
  // ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-23"}
  anrOwnedFiles: string[];
}

const UPSTREAM_REMOTE = "upstream";
const UPSTREAM_REPO = "https://github.com/sst/opencode.git";
const UPSTREAM_BRANCH = "dev";



const EXEMPT_PATTERNS = [
  /^packages\/anr-core\//,
  /^src\/generated\//,
  /^src\/generated-effect\//,
  /\.lock$/,
  /bun\.lockb$/,
];

const MARKER_REGEX = /ANRCODE_CHANGE\s*\{[^}]+\}/;

function isExempt(filePath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(filePath));
}

// ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-24"}
function isANROwned(filePath: string): boolean {
  // All files outside packages/anr-core/ (and not exempt) are ANR-owned and require markers
  return !isExempt(filePath);
}

function hasMarker(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return MARKER_REGEX.test(content);
  } catch {
    return false;
  }
}

function getCurrentBranch(): string {
  const result = spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf-8",
  });
  if (result.success) {
    return result.stdout.trim();
  }
  return "unknown";
}

function ensureUpstreamRemote(): void {
  // Check if upstream remote exists
  const listResult = spawnSync(["git", "remote", "get-url", UPSTREAM_REMOTE], {
    encoding: "utf-8",
  });

  if (!listResult.success) {
    // Add upstream remote
    spawnSync(["git", "remote", "add", UPSTREAM_REMOTE, UPSTREAM_REPO], {
      encoding: "utf-8",
    });
  }
}

function getDivergedFiles(): string[] {
  ensureUpstreamRemote();

  // Fetch upstream
  spawnSync(["git", "fetch", UPSTREAM_REMOTE, UPSTREAM_BRANCH, "--quiet"], {
    encoding: "utf-8",
  });

  // Get diverged files
  const result = spawnSync(
    [
      "git",
      "diff",
      "--name-only",
      `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...HEAD`,
    ],
    { encoding: "utf-8" }
  );

  if (!result.success) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main(): void {
  const generatedAt = new Date().toISOString();
  const forkBranch = getCurrentBranch();
  const divergedFiles = getDivergedFiles();

  const markedFiles: string[] = [];
  const unmarkedFiles: string[] = [];
  const exemptFiles: string[] = [];
  // ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-23"}
  const anrOwnedFiles: string[] = [];

  for (const file of divergedFiles) {
    if (isExempt(file)) {
      exemptFiles.push(file);
    } else if (isANROwned(file)) {
      anrOwnedFiles.push(file);
      if (hasMarker(file)) {
        markedFiles.push(file);
      } else {
        unmarkedFiles.push(file);
      }
    } else if (hasMarker(file)) {
      markedFiles.push(file);
    } else {
      unmarkedFiles.push(file);
    }
  }

  const report: DivergenceReport = {
    generatedAt,
    upstreamRemote: UPSTREAM_REPO,
    upstreamBranch: UPSTREAM_BRANCH,
    forkBranch,
    summary: {
      totalDivergedFiles: divergedFiles.length,
      markedFiles: markedFiles.length,
      unmarkedFiles: unmarkedFiles.length,
      exemptFiles: exemptFiles.length,
      // ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-23"}
      anrOwnedFiles: anrOwnedFiles.length,
    },
    markedFiles,
    unmarkedFiles,
    exemptFiles,
    // ANRCODE_CHANGE {"issue":350,"branch":"fork-identify-agent-enforce","date":"2026-07-23"}
    anrOwnedFiles,
  };

  // Output JSON to stdout
  console.log(JSON.stringify(report, null, 2));

  // Output human-readable summary to stderr
  console.error("\n=== Fork Divergence Report ===\n");
  console.error(`Generated: ${generatedAt}`);
  console.error(`Upstream: ${UPSTREAM_REPO}/${UPSTREAM_BRANCH}`);
  console.error(`Fork branch: ${forkBranch}`);
  console.error(`\nSummary:`);
  console.error(`  Total diverged files: ${divergedFiles.length}`);
  console.error(`  With ANRCODE_CHANGE markers: ${markedFiles.length}`);
  console.error(`  Missing markers: ${unmarkedFiles.length}`);
  console.error(`  Exempt files: ${exemptFiles.length}`);
  console.error(`  ANR-owned files (all non-exempt): ${anrOwnedFiles.length}`);

  if (unmarkedFiles.length > 0) {
    console.error(`\nMissing markers (ANR-owned):`);
    unmarkedFiles.forEach((file) => console.error(`  - ${file}`));
  }

  if (exemptFiles.length > 0) {
    console.error(`\nExempt files (no marker required):`);
    exemptFiles.forEach((file) => console.error(`  - ${file}`));
  }
}

main();
