#!/usr/bin/env bun

/**
 * version-tag.ts
 *
 * Derives the next version from git tags instead of the npm registry.
 * Looks for the latest tag matching `v<major>.<minor>.<patch>`, then
 * increments according to OPENCODE_BUMP (major | minor | patch).
 *
 * Env vars:
 *   OPENCODE_BUMP     - "major" | "minor" | "patch" (required for release)
 *   OPENCODE_VERSION  - explicit override; skips bump logic
 *   OPENCODE_CHANNEL  - channel name; defaults to branch name or "latest"
 *   OPENCODE_API_KEY  - passed through for changelog generation
 *   GH_TOKEN          - GitHub token for creating releases
 *   GH_REPO           - target repo (e.g. anomalyco/opencode)
 *
 * Outputs (via GITHUB_OUTPUT):
 *   version  - the resolved semver string
 *   release  - GitHub release database ID (only for non-preview)
 *   tag      - the git tag name (e.g. v1.3.0)
 *   repo     - the target repo
 */

import { $ } from "bun"
import { buildNotes, getLatestRelease } from "./changelog"

const bump = process.env["OPENCODE_BUMP"]
const override = process.env["OPENCODE_VERSION"]
const channel = process.env["OPENCODE_CHANNEL"]

const resolvedChannel = await (async () => {
  if (channel) return channel
  if (bump) return "latest"
  if (override && !override.startsWith("0.0.0-")) return "latest"
  return $`git branch --show-current`.text().then((x) => x.trim())
})()

const preview = resolvedChannel !== "latest"

const version = await (async () => {
  if (override) return override
  if (preview) return `0.0.0-${resolvedChannel}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`

  // Derive from the latest git tag
  const raw = await $`git tag -l "v*.*.*" --sort=-v:refname`.text()
  const tags = raw
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))

  if (tags.length === 0) throw new Error("No version tags found in the repository")

  const latest = tags[0]!.slice(1) // strip leading "v"
  const [major, minor, patch] = latest.split(".").map((x) => Number(x) || 0)

  const t = bump?.toLowerCase()
  if (t === "major") return `${major! + 1}.0.0`
  if (t === "minor") return `${major}.${minor! + 1}.0`
  return `${major}.${minor}.${patch! + 1}`
})()

console.log(`channel: ${resolvedChannel}`)
console.log(`version: ${version}`)
console.log(`preview: ${preview}`)

const output = [`version=${version}`]

if (!preview) {
  const previous = await getLatestRelease()
  const notes = previous ? await buildNotes(previous, "HEAD") : ["Initial release"]
  const body = notes.join("\n") || "No notable changes"
  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const file = `${dir}/opencode-release-notes.txt`
  await Bun.write(file, body)
  await $`gh release create v${version} -d --title "v${version}" --notes-file ${file}`
  const release = await $`gh release view v${version} --json tagName,databaseId`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
} else {
  const repo = process.env.GH_REPO
  await $`gh release create v${version} -d --prerelease --title "v${version}" --notes "Preview release ${version}" --repo ${repo}`
  const release = await $`gh release view v${version} --json tagName,databaseId --repo ${repo}`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

output.push(`repo=${process.env.GH_REPO}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
