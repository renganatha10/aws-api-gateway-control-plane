import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

const EMAIL = `smoke+${Date.now()}@mailinator.com`;
const PASSWORD = "Playwright@2025!";

const PETS_YAML = readFileSync(
  resolve("tests/e2e/fixtures/pets-api.yaml"),
  "utf-8",
);

// ── Helpers ────────────────────────────────────────────────────────────────

async function selectOption(
  page: import("@playwright/test").Page,
  placeholder: string,
  optionText: string | RegExp,
) {
  await page.getByText(placeholder).click();
  await page.getByRole("option", { name: optionText }).click();
}

async function createApi(
  page: import("@playwright/test").Page,
  name: string,
  scope: string,
  yaml: string,
) {
  await page.goto("/apis/new");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#yaml")).toBeVisible();
  await page.locator("#name").fill(name);
  await page.locator("#scope").fill(scope);
  await page.locator("#yaml").click({ clickCount: 3 });
  await page.locator("#yaml").press("Control+a");
  await page.locator("#yaml").fill(yaml);
  await page.getByRole("button", { name: "Save API" }).click();
  await page.waitForURL("**/apis", { timeout: 30_000 }).catch(async () => {
    const err = await page
      .locator(".text-destructive")
      .textContent()
      .catch(() => "");
    throw new Error(`API "${name}" creation failed: "${err?.trim()}"`);
  });
  await expect(page.getByText(name)).toBeVisible();
}

async function createProduct(
  page: import("@playwright/test").Page,
  displayName: string,
  description: string,
) {
  await page.goto("/products/new");
  await page.locator("#displayName").fill(displayName);
  await page.locator("#description").fill(description);
  await page.getByRole("button", { name: "Create Product" }).click();
  await page.waitForURL("**/products/**", { timeout: 10_000 });
}

async function configureProduct(
  page: import("@playwright/test").Page,
  apiNames: string[],
  planPattern: string | RegExp,
) {
  await page.getByRole("button", { name: "APIs" }).click();
  for (const name of apiNames) {
    await selectOption(page, "Select an API…", name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("cell", { name }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Plans" }).click();
  await selectOption(page, "Select a plan…", planPattern);
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

async function deployProduct(
  page: import("@playwright/test").Page,
  displayName: string,
  envName: string,
) {
  await page.goto("/products");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("row").filter({ hasText: displayName }).click();
  await page.waitForURL("**/products/**");
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("dialog").getByText(envName, { exact: true }).click();
  await page.getByRole("button", { name: "Deploy" }).click();
  await expect(page.getByText(/Published to/)).toBeVisible({
    timeout: 120_000,
  });
}

async function createConsumer(
  page: import("@playwright/test").Page,
  consumerName: string,
  productName: string | RegExp,
  planPattern: string | RegExp,
) {
  await page.goto("/consumers/new");
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#name").fill(consumerName);
  await selectOption(page, "Select a product…", productName);
  await selectOption(page, "Select a stage…", "prod");
  await selectOption(page, "Select a plan…", planPattern);
  await page.getByRole("button", { name: "Save Consumer" }).click();
  await page.waitForURL("**/consumers", { timeout: 30_000 });
  await expect(page.getByText(consumerName)).toBeVisible();
}

// ── Test ───────────────────────────────────────────────────────────────────

test.describe("Smoke — minimal end-to-end flow", () => {
  test.setTimeout(600_000);

  test("1 api · 1 env · 1 plan · 1 product · 1 consumer · tryout verify · teardown", async ({
    page,
  }) => {
    // Captured mid-test for use in later teardown steps.
    let consumerId = "";

    // 1. Sign up
    await test.step("Sign up", async () => {
      await page.goto("/login?mode=signup");
      await page.getByLabel("First name").fill("Smoke");
      await page.getByLabel("Last name").fill("Test");
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();
      await page.waitForURL("**/organisation", { timeout: 10_000 });
    });

    // 1b. Create organisation (onboarding step for new users)
    await test.step("Create organisation", async () => {
      await page.getByLabel("Organisation name").fill("smoke-org");
      await page.getByRole("button", { name: "Create Organisation" }).click();
      await page.waitForURL(/localhost:5173\/$/, { timeout: 10_000 });
    });

    // 2. Create pets API
    await test.step("Create API: pets-api", async () => {
      await createApi(page, "pets-api", "pets", PETS_YAML);
    });
    await page.waitForTimeout(10_000);

    // 3. Create prod environment
    await test.step("Create environment: prod", async () => {
      await page.goto("/environments");
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#env-name").fill("prod");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("cell", { name: "prod" })).toBeVisible({
        timeout: 10_000,
      });
    });
    await page.waitForTimeout(10_000);

    // 4. Create standard plan
    await test.step("Create plan: standard", async () => {
      await page.goto("/plans");
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#plan-name").fill("standard");
      await page.locator("#plan-throttle").fill("100");
      await page.locator("#plan-burst").fill("200");
      await page.getByPlaceholder("e.g. 100000").fill("50000");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText("standard")).toBeVisible({ timeout: 10_000 });
    });
    await page.waitForTimeout(10_000);

    // 5. Create product, attach API + plan, deploy to prod
    await test.step("Create product: Pet Store", async () => {
      await createProduct(page, "Pet Store", "Pets API product");
      await configureProduct(page, ["pets-api"], /standard/);
    });

    await test.step("Deploy Pet Store to prod", async () => {
      await deployProduct(page, "Pet Store", "prod");
    });
    await page.waitForTimeout(10_000);

    // 6. Create consumer
    await test.step("Create consumer: Consumer A", async () => {
      await createConsumer(page, "Consumer A", "Pet Store", /standard/);
    });
    // AWS API key + usage plan association takes 30-60 s to propagate.
    await page.waitForTimeout(30_000);

    // 7. Verify endpoint returns 200 via the tryout page UI
    await test.step("Verify: invoke endpoint via tryout page returns 200", async () => {
      // Get consumerId from the URL.
      await page.goto("/consumers");
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("row").filter({ hasText: "Consumer A" }).click();
      await page.waitForURL("**/consumers/**");
      consumerId = page.url().split("/").pop()!;

      // Navigate to tryout page and fetch an OAuth token.
      await page.goto(`/consumers/${consumerId}/tryout`);
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("button", { name: "Get Token" }).click();
      await expect(
        page.locator("section").filter({ hasText: "Credentials" }).locator(".font-mono.text-xs.text-gray-800"),
      ).toBeVisible({ timeout: 30_000 });

      // Select the GET /pet/findByStatus endpoint (API is auto-selected — only one).
      await selectOption(page, "Select an endpoint…", /findByStatus/);
      // Fill in the auto-added "status" query param.
      await expect(page.locator('input[placeholder="value"]').first()).toBeVisible({ timeout: 5_000 });
      await page.locator('input[placeholder="value"]').first().fill("available");

      // Retry send until 200 — AWS API key propagation can take up to 90 s.
      const invokeDeadline = Date.now() + 90_000;
      while (Date.now() < invokeDeadline) {
        await page.getByRole("button", { name: "Send Request" }).click();
        // Wait for the request to finish (button re-enables when fetcher is idle).
        await expect(page.getByRole("button", { name: "Send Request" })).toBeVisible({ timeout: 30_000 });

        const has200 = await page
          .locator("section")
          .filter({ hasText: "Response" })
          .getByText("200", { exact: true })
          .isVisible()
          .catch(() => false);
        if (has200) break;

        const statusEl = page.locator("section").filter({ hasText: "Response" }).locator("span.font-semibold").first();
        const statusText = await statusEl.textContent().catch(() => "?");
        console.log(`── Invoke retry (${statusText?.trim()}) — waiting 10 s for API key propagation…`);
        await page.waitForTimeout(10_000);
      }
      await expect(
        page.locator("section").filter({ hasText: "Response" }).getByText("200", { exact: true }),
      ).toBeVisible({ timeout: 5_000 });
    });

    // ── Teardown ──────────────────────────────────────────────────────────────

    // 8. Delete consumer → verify it's gone from the list
    await test.step("Delete consumer: Consumer A", async () => {
      await page.goto(`/consumers/${consumerId}`);
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await page.waitForURL("**/consumers", { timeout: 30_000 });
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("cell", { name: "Consumer A", exact: true })).toHaveCount(0);
    });

    // 9. Delete product → verify it's gone from the list
    await test.step("Delete product: Pet Store", async () => {
      await page.goto("/products");
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("row").filter({ hasText: "Pet Store" }).click();
      await page.waitForURL("**/products/**");
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await page.waitForURL("**/products", { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: "Pet Store" })).toHaveCount(0);
    });

    // 10. Delete API → verify it's gone from the list
    await test.step("Delete API: pets-api", async () => {
      await page.goto("/apis");
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("row").filter({ hasText: "pets-api" }).click();
      await page.waitForURL("**/apis/**");
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await page.waitForURL("**/apis", { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: "pets-api" })).toHaveCount(0);
    });
  });
});
