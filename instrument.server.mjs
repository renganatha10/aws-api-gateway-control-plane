import { register } from "node:module";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import pino from "pino";

// Register OTel ESM hook loader before any app modules load.
// Required for ESM apps — without this, auto-instrumentation silently no-ops.
register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

const sdk = new NodeSDK({
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(), // gRPC → localhost:4317 → OTel Collector
    exportIntervalMillis: 60_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
    new PinoInstrumentation(),
  ],
});

sdk.start();

// Create the shared pino logger. PinoInstrumentation (started above) will
// automatically inject trace_id + span_id into every log record.
const logger = pino({
  base: { service: "portal", env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  level: process.env.LOG_LEVEL ?? "info",
});

// Expose globally so logger.server.ts can reuse the same instance.
globalThis.__portalLogger = logger;

// Console shim — active from process start, covers all 88 call sites.
// Convention: console.error("[module] desc", err?) — the shim detects Errors
// and maps them to pino's { err } field so stack traces stay in one JSON object.
function extractErr(args) {
  return args.find((a) => a instanceof Error);
}
function toMsg(args) {
  const text = args
    .filter((a) => !(a instanceof Error))
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")
    .trim();
  return text || "error";
}

console.error = (...args) => {
  const err = extractErr(args);
  err ? logger.error({ err }, toMsg(args)) : logger.error(toMsg(args));
};
console.warn = (...args) => {
  const err = extractErr(args);
  err ? logger.warn({ err }, toMsg(args)) : logger.warn(toMsg(args));
};
console.info = (...args) => logger.info(toMsg(args));
console.log = (...args) => logger.info(toMsg(args));

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
