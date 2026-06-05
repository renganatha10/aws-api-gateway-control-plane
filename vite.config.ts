import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // In production CI: VITE_ASSETS_BASE_URL=https://static.rengaonline.in/
  // In local dev: falls back to "/" so dev server works as before.
  base: process.env.VITE_ASSETS_BASE_URL ?? "/",
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
