# Structured logging + OpenTelemetry plan (DRAFT — paused, decisions pending)

Status: **paused before implementation.** Two decisions still need to be made (see
"Pending decisions"). Nothing below has been built yet. Resume from here.

## The problem we're solving

CloudWatch shows every line of a stack trace as a **separate log event**. Example
symptom: each frame of a Node error trace is its own event with its own ingestion
timestamp.

### Root cause (two coupled issues)

1. **pm2 stamps a date on every line.** `ecosystem.local.config.cjs` sets
   `log_date_format: "YYYY-MM-DD HH:mm:ss Z"`, which prepends
   `2026-05-25 07:21:10 +00:00:` to *every* line pm2 writes, including each line of a
   multi-line stack trace.
2. **The CloudWatch multiline rule keys on that date.** `cloudwatch-agent-local.json`
   uses `multi_line_start_pattern: "^\\d{4}-\\d{2}-\\d{2}"`. Because pm2 made every line
   start with a date, every line matches "start of new event" → each frame becomes its
   own event. The leading `...T..+05:30` lines in the CloudWatch console are its
   per-event ingestion timestamps.

Also note an existing `%z` mismatch: pm2 emits `+00:00` (with colon) but the agent's
`timestamp_format` `%z` expects `+0000` — so embedded timestamps weren't parsed and the
agent fell back to ingestion time.

Conclusion: plain-text logs + per-line pm2 timestamps + tail-to-CloudWatch is
fundamentally fragile. Fix = **structured single-line JSON** (one event = one JSON
object = one line; stack trace is an escaped string field, so there are no real
newlines to split on).

## Recommended architecture

- **pino** emits single-line JSON to **stdout**. pm2 captures it verbatim; we **drop
  `log_date_format`** so pm2 stops mangling lines. CloudWatch ingests one object per
  event; Logs Insights auto-parses fields. (Use plain stdout, no pino worker
  transports — avoids transport complexity under react-router-serve.)
- **OpenTelemetry**: `@opentelemetry/sdk-node` + auto-instrumentations +
  `@opentelemetry/instrumentation-pino`, preloaded via
  `node --import ./instrument.server.mjs` **before** the app starts. Instrumentation-pino
  stamps `trace_id`/`span_id` into every log line for log/trace correlation.

### Key feasibility finding (verified 2026-05-25)

The server build (`build/server/index.js`) keeps node deps **external** — real ESM
imports like `import pg from "pg"` and `import { ... } from "@aws-sdk/..."`, NOT
bundled. This is what makes OTel auto-instrumentation viable: it hooks pg queries, AWS
SDK calls, and HTTP. If deps were bundled, OTel couldn't see them and tracing would be
near-useless.

### Field mapping (what the user asked for)

| Requested  | pino field                       |
|------------|----------------------------------|
| timestamp  | `time` (configure ISO)           |
| logLevel   | `level`                          |
| message    | `msg`                            |
| service    | base field `service: "portal"`   |
| host       | `hostname`                       |
| env        | base field `env` (from NODE_ENV) |
| stack trace| `err.stack` (error serializer)   |
| trace      | `trace_id` / `span_id` (OTel)    |

## Pending decisions (ASK BEFORE IMPLEMENTING)

### 1. Trace export destination (logs go to CloudWatch regardless; this is only spans)
- **(a) Log correlation only** — inject `trace_id`/`span_id` into logs, export no spans.
  No collector. Lightest; can add a backend later. *(leaning recommendation)*
- **(b) Export to AWS X-Ray** — run the ADOT collector locally; spans → X-Ray. Matches
  the AWS/CloudWatch setup but adds a collector process alongside pm2.
- **(c) OTLP to console/local** — export to console (dev) or local Jaeger/Tempo. Good
  for local inspection; not persisted to CloudWatch.

### 2. How to handle the 87 existing `console.*` calls
All consistently follow `console.error("[module] desc", err)`.
- **(a) Console shim (zero edits)** — patch `console.*` to route through pino, detect
  Error args and extract them into a clean `stack`/`err` field. Single-line JSON
  immediately, separate stack field, no call-site changes. Works *because* the
  convention is consistent. *(leaning recommendation)*
- **(b) Full migration** — replace all 87 sites with `log.error({ err }, "[module] desc")`.
  Cleanest, but large mechanical diff.
- **(c) Incremental** — add logger + shim now, migrate auth/AWS hot paths explicitly,
  leave the rest on the shim.

## Implementation steps (once decisions are locked)

1. Add deps: `pino`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`,
   `@opentelemetry/instrumentation-pino` (+ X-Ray/ADOT pieces only if decision 1 = b).
2. Create `app/lib/logger.server.ts` — pino with base fields `service: "portal"`, `env`,
   ISO `time`, std error serializer. (Plus console shim if decision 2 = a/c.)
3. Create `instrument.server.mjs` at repo root — NodeSDK + instrumentations. **Under ESM
   must register the OTel module-hook loader (`register()` from `module`), not just
   `sdk.start()`**, or instrumentation silently no-ops.
4. Wire preload: add `node_args: "--import ./instrument.server.mjs"` (or `NODE_OPTIONS`)
   in `ecosystem.local.config.cjs`; mirror for `npm run start`/dev if wanted.
5. `ecosystem.local.config.cjs`: **remove `log_date_format`** (stop per-line stamping).
6. `cloudwatch-agent-local.json`: change `multi_line_start_pattern` to `^\\{` (JSON
   objects start with `{`); set `timestamp_format` to match pino's ISO `time`
   (`%Y-%m-%dT%H:%M:%S.%fZ`) or drop it and accept ingestion time.
7. Restart: rebuild, `pm2 delete` + fresh start (pm2 caches env — reload won't refresh),
   re-fetch CW agent config.
8. Verify in CloudWatch Logs Insights: one event per error, fields parsed, `trace_id`
   groups a request's lines.

## Sharp edges / gotchas

- **ESM instrumentation hook** (step 3) is the #1 silent-failure trap.
- pm2 caches the env from first launch; use `delete` + fresh `start`, not `reload`
  (already hardened in `scripts/start-local.sh`).
- Console shim (decision 2a) relies on the consistent `(\"[module] desc\", err)`
  convention — spot-check a few non-conforming calls.

## Unrelated bug spotted in the logs (separate from this work)

The login failure in the sample logs was `clientId 'your-app-client-id' failed ...
pattern [\\w+]+` — i.e. `COGNITO_CLIENT_ID` in `.env` is still the placeholder
`your-app-client-id`. Needs a real Cognito App Client ID. Not part of the logging work.
