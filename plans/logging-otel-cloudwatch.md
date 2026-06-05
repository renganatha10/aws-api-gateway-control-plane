# Plan: Fix Logging Pipeline — OTel Contrib → CloudWatch

## Diagnosis

### Root cause of 0 bytes in `/app/ec2/application`

The EC2 instance (`i-0ac6ac82aaef5e50d`) has:
- `otelcol-contrib` running and healthy (active 6h+)
- `api-portal` running under PM2 as `ec2-user` (200 MB, 6h uptime)
- `/var/log/api-portal/out.log` exists with 2,008 lines

But of those 2,008 lines:
- **40 are pino JSON** — written at app startup (18:24)
- **1,964 are plain-text access logs** — `GET /health 200 - - 1.1 ms`

The plain-text lines come from `react-router-serve`'s built-in request logger, which writes directly to stdout and bypasses the `console.log` pino shim.

The otelcol `filter` processor drops every record where `attributes["msg"] == nil` — which is 100% of plain-text lines (json_parser doesn't parse them, so no attributes are extracted).

Additionally, `start_at: end` in the filelog receiver means otelcol (started at 18:42) never read the 40 JSON startup lines written at 18:24. Since then, every new line is a health-check access log — all dropped by the filter.

**Result: nothing has ever reached the `awscloudwatchlogs` exporter.**

### Body/attributes noise

When `json_parser` runs on a pino line, otelcol produces:
- `body` = raw JSON blob: `{"level":30,"time":"2026-06-04T18:24:47.580Z","msg":"starting","service":"portal",...}`
- `attributes` = every pino field duplicated: `level`, `time`, `msg`, `service`, `env`, `trace_id`, `span_id`, ...

The body is redundant and makes CloudWatch Log Insights queries harder to read.

---

## Current architecture

```
pino (instrument.server.mjs)
  └─ stdout → PM2 → /var/log/api-portal/out.log
                            │
react-router-serve (built-in logger)
  └─ stdout → PM2 → /var/log/api-portal/out.log  (plain text, not JSON)

otelcol-contrib
  filelog receiver → json_parser → filter (msg != nil) → awscloudwatchlogs
                                           ↑ drops ALL plain-text lines
  otlp receiver (gRPC :4317) → prometheus exporter (metrics only)
```

---

## Phase 1 — Fix CloudWatch now (otelcol config only, no app code changes)

**Update `/etc/otelcol-contrib/config.yaml` on the instance (and the CloudFormation UserData template in `infra/3-compute.yaml`).**

### 1. `start_at: beginning`

Re-read the log file from the top so existing JSON lines and all future ones are consumed. Previously `start_at: end` caused otelcol to skip everything written before it started.

### 2. Replace the `filter` processor

The current `attributes["msg"] == nil` filter is too aggressive — it silently drops everything. Replace with a targeted filter that only suppresses health-check noise:

```yaml
filter:
  error_mode: ignore
  logs:
    log_record:
      - 'IsMatch(body, "^GET /health ")'
      - 'IsMatch(body, "^HEAD /health ")'
```

Everything else — JSON pino lines and other access logs — passes through.

### 3. Add a `transform` processor to clean up body noise

After `json_parser` extracts pino fields into attributes, set `body` to just the human message and remove the duplicated fields:

```yaml
transform:
  log_statements:
    - context: log
      statements:
        - set(body, attributes["msg"])
        - delete_key(attributes, "msg")    # now the body, no longer needed as attribute
        - delete_key(attributes, "time")   # already the log record timestamp
        - delete_key(attributes, "level")  # already the severity level
```

CloudWatch will then show `body = "User logged in"` with `service`, `env`, `trace_id`, `span_id` as clean attributes.

### 4. Updated pipeline order

```yaml
processors: [json_parser (operator), transform, filter, batch]
```

(json_parser is an operator inside the filelog receiver, not a standalone processor)

### Rollout

- Update `infra/3-compute.yaml` UserData OTELCFG block with the new config
- Patch the live instance: `sudo tee /etc/otelcol-contrib/config.yaml << 'EOF' ... EOF`
- `sudo systemctl restart otelcol-contrib`
- Verify: `aws logs tail /app/ec2/application --follow`

---

## Phase 2 — Send pino logs via OTLP (eliminate file-based pipeline)

The file-based pipeline (`filelog → json_parser`) is fragile: log rotation, startup races, and format mixing all cause silent gaps. otelcol already has a gRPC OTLP receiver on port 4317 (currently used for metrics).

### App changes (`instrument.server.mjs`)

Add log export alongside the existing metric export:

```js
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";

const sdk = new NodeSDK({
  // existing metric reader ...
  logRecordProcessor: new SimpleLogRecordProcessor(new OTLPLogExporter()),
  instrumentations: [
    getNodeAutoInstrumentations({ ... }),
    new PinoInstrumentation(),  // bridges pino records into OTel log signals
  ],
});
```

New package needed: `@opentelemetry/exporter-logs-otlp-grpc`

### otelcol changes

Add a logs pipeline on the existing `otlp` receiver:

```yaml
service:
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [transform, filter, batch]
      exporters: [awscloudwatchlogs]
```

The `transform` processor still strips redundant fields. The `filter` still suppresses health checks (though with OTLP the health-check plain-text lines never arrive — they're app-server noise, not pino output).

Remove the `file_log` receiver entirely once OTLP logs are confirmed working.

---

## Phase 3 — React Router 7 custom server + proper instrumentation

Replace `react-router-serve` with a custom server entry point. This eliminates the 1,964 plain-text access log lines at the source and enables proper route-level OTel spans.

### Why

`react-router-serve` writes its own Morgan-style request log directly to stdout. There is no way to suppress it or make it structured without replacing the server. A custom server lets you:
- Use `pino-http` for structured HTTP access logs (JSON, suppressable per route)
- Use React Router's `createRequestHandler` directly
- Suppress health-check request logging entirely

### What to build

**`server.mjs`** — loaded by PM2 instead of `react-router-serve`:

```js
// PM2 start command:
// node --import ./instrument-hook.mjs --import ./instrument.server.mjs server.mjs

import { createServer } from "node:http";
import { createRequestHandler } from "@react-router/express"; // or the node adapter
import pinoHttp from "pino-http";

const httpLogger = pinoHttp({
  logger: globalThis.__portalLogger,
  autoLogging: {
    ignore: (req) => req.url === "/health",  // suppress health check noise
  },
});

const handler = createRequestHandler({ build: await import("./build/server/index.js") });

createServer((req, res) => {
  httpLogger(req, res);
  handler(req, res);
}).listen(3000);
```

**React Router OTel spans** — `getNodeAutoInstrumentations` already instruments the HTTP layer. For route-level spans (loader, action), use `@opentelemetry/instrumentation-react-router` when it reaches stable, or wrap loaders manually with `tracer.startActiveSpan`.

Following: https://reactrouter.com/how-to/instrumentation

### PM2 ecosystem change

Update `ecosystem.config.cjs` (or equivalent):
```js
// before
script: "./node_modules/.bin/react-router-serve",
args:    "./build/server/index.js",

// after
script: "node",
args:   "--import ./instrument-hook.mjs --import ./instrument.server.mjs server.mjs",
```

---

## Sequencing

| # | Phase | Scope | Outcome |
|---|---|---|---|
| 1 | Fix otelcol config | EC2 config + infra template | Logs appear in CloudWatch today |
| 2 | OTLP log export from pino | `instrument.server.mjs` + otelcol | Remove fragile file pipeline |
| 3 | Custom server + pino-http | New `server.mjs` + PM2 config | Structured HTTP logs, no plain-text noise, route spans |

Phase 1 can be deployed independently with no app changes. Phases 2 and 3 require a normal app deploy.
