import { register } from "node:module";

// Must be loaded via a dedicated --import BEFORE instrument.server.mjs.
// ESM static imports are hoisted and resolved before the module body runs,
// so calling register() inside instrument.server.mjs is always too late —
// pino and http are already loaded by the time register() executes there.
// Loading this file first ensures the hook is active before any module loads.
register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
