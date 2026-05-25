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
      COGNITO_USER_POOL_ID: "us-east-1_TestPool",
      COGNITO_CLIENT_ID: "test-client-id",
      COGNITO_CLIENT_SECRET: "test-client-secret",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "test-access-key",
      AWS_SECRET_ACCESS_KEY: "test-secret-access-key",
      COGNITO_USER_POOL_ARN: "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_TestPool",
    },
  },
})
