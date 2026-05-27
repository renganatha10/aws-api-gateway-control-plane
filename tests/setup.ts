/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";

vi.mock("~/hooks/use-permissions", () => ({
  usePermissions: () => ({ role: "admin" as const, can: () => true }),
}));
