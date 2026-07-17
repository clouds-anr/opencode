#!/usr/bin/env bun

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Commands } from "./commands/commands"
import { Runtime } from "./framework/runtime"
import { Daemon } from "./services/daemon"
import { Global } from "@opencode-ai/core/global"

function parseDiagnosticArg(arg: string) {
  if (arg === "--diagnostic") return true
  if (!arg.startsWith("--diagnostic=")) return false
  const value = arg.slice("--diagnostic=".length).toLowerCase()
  return value !== "false" && value !== "0"
}

function isDiagnosticEnabled(args: string[]) {
  return args.some(parseDiagnosticArg)
}

function stripDiagnosticFlag(args: string[]) {
  return args.filter((arg) => !arg.startsWith("--diagnostic"))
}

function startDiagnosticSession(args: string[]) {
  const startedAt = new Date().toISOString()
  const stamp = startedAt.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-")
  const mode = process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "non-interactive"
  const root = process.env.OPENCODE_DIAGNOSTIC_ROOT?.trim() || path.join(Global.Path.log, "diagnostics")
  const directory = path.join(root, `${stamp}-${process.pid}`)

  mkdirSync(directory, { recursive: true })
  writeFileSync(
    path.join(directory, "session.json"),
    JSON.stringify(
      {
        startedAt,
        pid: process.pid,
        mode,
        cwd: process.cwd(),
        argv: args,
      },
      null,
      2,
    ),
  )

  process.env.OPENCODE_DIAGNOSTIC = "1"
  process.env.OPENCODE_DIAGNOSTIC_DIR = directory

  process.stderr.write("\n")
  process.stderr.write("OpenCode diagnostic mode enabled\n")
  process.stderr.write(`mode: ${mode}\n`)
  process.stderr.write(`diagnostics directory: ${directory}\n\n`)

  return { directory, mode, startedAt }
}

const cliArgs = process.argv.slice(2)
const diagnosticSession = isDiagnosticEnabled(cliArgs) ? startDiagnosticSession(cliArgs) : undefined

if (diagnosticSession) {
  process.argv = [process.argv[0] ?? "", process.argv[1] ?? "", ...stripDiagnosticFlag(cliArgs)]
}

if (diagnosticSession) {
  process.on("exit", (code) => {
    writeFileSync(
      path.join(diagnosticSession.directory, "exit.json"),
      JSON.stringify(
        {
          startedAt: diagnosticSession.startedAt,
          endedAt: new Date().toISOString(),
          pid: process.pid,
          mode: diagnosticSession.mode,
          exitCode: code,
        },
        null,
        2,
      ),
    )
  })
}

const Handlers = Runtime.handlers(Commands, {
  $: () => import("./commands/handlers/default"),
  api: () => import("./commands/handlers/api"),
  debug: {
    agents: () => import("./commands/handlers/debug/agents"),
  },
  migrate: () => import("./commands/handlers/migrate"),
  service: {
    start: () => import("./commands/handlers/service/start"),
    restart: () => import("./commands/handlers/service/restart"),
    status: () => import("./commands/handlers/service/status"),
    stop: () => import("./commands/handlers/service/stop"),
    password: () => import("./commands/handlers/service/password"),
  },
  serve: () => import("./commands/handlers/serve"),
})

Runtime.run(Commands, Handlers, { version: "local" }).pipe(
  Effect.provide(Daemon.layer),
  Effect.provide(NodeServices.layer),
  Effect.scoped,
  NodeRuntime.runMain,
)
