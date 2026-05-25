import pino from "pino";

// In production (node --import ./instrument.server.mjs), the logger is created
// there and stored globally so OTel trace_id injection is already wired.
// In dev / tests (no preload), create a fresh instance that logs without tracing.
export const logger: pino.Logger =
  (globalThis as { __portalLogger?: pino.Logger }).__portalLogger ??
  pino({
    base: { service: "portal", env: process.env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { err: pino.stdSerializers.err },
    level: process.env.LOG_LEVEL ?? "info",
  });
