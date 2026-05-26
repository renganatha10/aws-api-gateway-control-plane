import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost/testdb",
      SESSION_SECRET: "test-secret-key-for-unit-tests-only",
      COGNITO_USER_POOL_ID: "ap-south-1_TestPool",
      COGNITO_CLIENT_ID: "test-client-id",
      COGNITO_CLIENT_SECRET: "test-client-secret",
      AWS_REGION: "ap-south-1",
      AWS_ACCESS_KEY_ID: "test-access-key",
      AWS_SECRET_ACCESS_KEY: "test-secret-access-key",
      COGNITO_USER_POOL_ARN: "arn:aws:cognito-idp:ap-south-1:123456789012:userpool/ap-south-1_TestPool",
    },
  },
})
