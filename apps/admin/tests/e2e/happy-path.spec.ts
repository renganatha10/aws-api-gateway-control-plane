import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Credentials (hardcoded) ────────────────────────────────────────────────
// Email uses a timestamp so each test run creates a fresh Cognito account.
// To re-use an existing account, replace with a fixed email.
const EMAIL = `e2e+${Date.now()}@mailinator.com`;
const PASSWORD = "Playwright@2025!";

// ── YAML specs (securityDefinitions, externalDocs, and per-op security removed) ──
const PETS_YAML = readFileSync(
  resolve("tests/e2e/fixtures/pets-api.yaml"),
  "utf-8",
);
const USERS_YAML = readFileSync(
  resolve("tests/e2e/fixtures/users-api.yaml"),
  "utf-8",
);
const STORES_YAML = readFileSync(
  resolve("tests/e2e/fixtures/stores-api.yaml"),
  "utf-8",
);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Open Radix Select trigger by its placeholder text and pick an option. */
async function selectOption(
  page: import("@playwright/test").Page,
  placeholder: string,
  optionText: string | RegExp,
) {
  await page.getByText(placeholder).click();
  await page.getByRole("option", { name: optionText }).click();
}

/** Navigate to /apis/new, fill the form, and save. */
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
  // Triple-click to select all default content before typing replacement
  await page.locator("#yaml").click({ clickCount: 3 });
  await page.locator("#yaml").press("Control+a");
  await page.locator("#yaml").fill(yaml);
  await page.getByRole("button", { name: "Save API" }).click();
  await page.waitForURL("**/apis", { timeout: 30_000 }).catch(async () => {
    const errText = await page
      .locator(".text-destructive")
      .textContent()
      .catch(() => "");
    throw new Error(
      `API "${name}" creation failed — server returned: "${errText?.trim()}"`,
    );
  });
  await expect(page.getByText(name)).toBeVisible();
}

/** Create a product and return. Lands on the product detail page. */
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

/** From /products, open the publish modal for the named product and deploy to the given env. */
async function deployProduct(
  page: import("@playwright/test").Page,
  displayName: string,
  envName: string,
) {
  await page.goto("/products")
  await page.waitForLoadState("domcontentloaded")
  const row = page.getByRole("row").filter({ hasText: displayName })
  await row.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Publish" }).click()
  await page.getByRole("dialog").getByText(envName, { exact: true }).click()
  await page.getByRole("button", { name: "Deploy" }).click()
  await expect(page.getByText(/Published to/)).toBeVisible({ timeout: 120_000 })
}

/** Navigate to the product detail page, open Deployments tab, verify an invoke URL is shown. */
async function verifyDeployment(
  page: import("@playwright/test").Page,
  displayName: string,
) {
  await page.goto("/products")
  await page.waitForLoadState("domcontentloaded")
  await page.getByRole("link", { name: displayName }).click()
  await page.waitForURL("**/products/**")
  await page.getByRole("button", { name: "Deployments" }).click()
  await expect(page.getByText(/\.execute-api\./)).toBeVisible({ timeout: 10_000 })
}

/** On the product detail page, add APIs and a plan, then save. */
async function configureProduct(
  page: import("@playwright/test").Page,
  apiNames: string[],
  planPattern: string | RegExp,
) {
  // ── APIs section ──
  await page.getByRole("button", { name: "APIs" }).click();
  for (const name of apiNames) {
    await selectOption(page, "Select an API…", name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("cell", { name }).first()).toBeVisible();
  }

  // ── Plans section ──
  await page.getByRole("button", { name: "Plans" }).click();
  await selectOption(page, "Select a plan…", planPattern);
  await page.getByRole("button", { name: "Add" }).click();

  // ── Save ──
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

/**
 * Create a consumer from /consumers/new.
 * Expects the product to already be deployed so the stage dropdown is populated.
 */
async function createConsumerForProduct(
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

/**
 * Navigate to the consumer detail page, read clientId / tokenUrl,
 * fetch the client secret and AWS API key value via internal API routes,
 * then POST the token URL and GET the invoke URL (from the product deployment page)
 * asserting both return HTTP 200.
 */
async function verifyConsumerUrls(
  page: import("@playwright/test").Page,
  consumerName: string,
  productName: string | RegExp,
  invokeTestPath: string,
) {
  // ── Navigate to consumer detail ──────────────────────────────────────────
  await page.goto("/consumers");
  await page.waitForLoadState("domcontentloaded");
  const row = page.getByRole("row").filter({ hasText: consumerName });
  await row.locator('[aria-haspopup="menu"]').click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.waitForURL("**/consumers/**");

  const consumerId = page.url().split("/").pop()!;
  const clientId   = (await page.getByTestId("client-id").textContent())!.trim();
  const tokenUrl   = (await page.getByTestId("token-url").textContent())!.trim();

  // ── Fetch secret + API key value via internal routes ────────────────────
  const [secretRes, apiKeyRes] = await Promise.all([
    page.request.get(`/api/consumer-secret/${consumerId}`),
    page.request.get(`/api/consumer-apikey/${consumerId}`),
  ]);
  const { secret: clientSecret } = await secretRes.json();
  const { apiKeyValue }          = await apiKeyRes.json();

  // ── Read invoke URL from product Deployments tab ─────────────────────────
  await page.goto("/products");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("link", { name: productName }).click();
  await page.waitForURL("**/products/**");
  await page.getByRole("button", { name: "Deployments" }).click();
  await expect(page.getByTestId("invoke-url")).toBeVisible({ timeout: 10_000 });
  const invokeUrl = (await page.getByTestId("invoke-url").textContent())!.trim();

  // ── Verify token URL → 200 ───────────────────────────────────────────────
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await page.request.post(tokenUrl, {
    headers: {
      "Authorization":  `Basic ${credentials}`,
      "Content-Type":   "application/x-www-form-urlencoded",
    },
    form: { grant_type: "client_credentials" },
  });
  expect(tokenRes.status()).toBe(200);
  const { access_token } = await tokenRes.json();

  // ── Verify invoke URL → 200 ──────────────────────────────────────────────
  const invokeRes = await page.request.get(`${invokeUrl}${invokeTestPath}`, {
    headers: {
      "x-api-key":    apiKeyValue,
      "Authorization": `Bearer ${access_token}`,
    },
  });
  expect(invokeRes.status()).toBe(200);
}

// ── Test suite ─────────────────────────────────────────────────────────────

test.describe("Happy path — full portal flow", () => {
  test.setTimeout(600_000); // 10 minutes — includes 3 AWS deploys + verification

  test("complete flow: sign-up → logout → sign-in → gateway → APIs → environments → plans → products", async ({
    page,
  }) => {
    // ── 1. Sign Up ─────────────────────────────────────────────────────────
    await test.step("Sign up new account", async () => {
      await page.goto("/login?mode=signup");
      await page.getByLabel("First name").fill("Playwright");
      await page.getByLabel("Last name").fill("Tester");
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();
      // After sign-up → redirect / → layout redirects new user to /gateway
      await page.waitForURL("**/gateway", { timeout: 10_000 });
    });

    // ── 2. Logout ──────────────────────────────────────────────────────────
    await test.step("Logout", async () => {
      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL("**/login", { timeout: 10_000 });
      await expect(page.getByText("Sign in to your workspace")).toBeVisible();
    });

    // ── 3. Sign In ─────────────────────────────────────────────────────────
    await test.step("Sign in with existing account", async () => {
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();
      // No gateway yet → redirected to /gateway
      await page.waitForURL("**/gateway", { timeout: 10_000 });
    });

    // ── 4. Create Gateway ──────────────────────────────────────────────────
    await test.step("Create gateway: petstore-gateway", async () => {
      await page.getByLabel("Gateway name").fill("petstore gateway");
      await page.getByRole("button", { name: "Create Gateway" }).click();
      await page.waitForURL(/\/$/, { timeout: 50_000 });
      await expect(page.getByText("petstore gateway")).toBeVisible();
    });

    // ── 5–7. Create APIs ───────────────────────────────────────────────────
    await test.step("Create API: pets-api", async () => {
      await createApi(page, "pets-api", "pets", PETS_YAML);
    });
    await page.waitForTimeout(10000);

    await test.step("Create API: users-api", async () => {
      await createApi(page, "users-api", "users", USERS_YAML);
    });

    await page.waitForTimeout(10000);

    await test.step("Create API: stores-api", async () => {
      await createApi(page, "stores-api", "stores", STORES_YAML);
    });

    await page.waitForTimeout(10000);

    // ── 8–9. Create Environments ───────────────────────────────────────────
    await test.step("Create environment: prod", async () => {
      await page.goto("/environments");
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#env-name").fill("prod");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("cell", { name: "prod" })).toBeVisible({
        timeout: 10_000,
      });
    });

    await page.waitForTimeout(10000);

    await test.step("Create environment: dev", async () => {
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#env-name").fill("dev");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("cell", { name: "dev" })).toBeVisible({
        timeout: 10_000,
      });
    });

    await page.waitForTimeout(10000);

    // ── 10–11. Create Plans ────────────────────────────────────────────────
    await test.step("Create plan: standard (100 rps / 50k per month)", async () => {
      await page.goto("/plans");
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#plan-name").fill("standard");
      await page.locator("#plan-throttle").fill("100");
      await page.locator("#plan-burst").fill("200");
      await page.getByPlaceholder("e.g. 100000").fill("50000");
      // quotaPeriod defaults to "month" — no change needed
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText("standard")).toBeVisible({ timeout: 10_000 });
    });

    await page.waitForTimeout(10000);

    await test.step("Create plan: premium (500 rps / 500k per month)", async () => {
      await page.getByRole("button", { name: "Add" }).click();
      await page.locator("#plan-name").fill("premium");
      await page.locator("#plan-throttle").fill("500");
      await page.locator("#plan-burst").fill("1000");
      await page.getByPlaceholder("e.g. 100000").fill("500000");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText("premium")).toBeVisible({ timeout: 10_000 });
    });

    // ── 12. Product 1: Marketplace (pets + users, standard plan) ──────────
    await test.step("Create product: Marketplace (pets-api + users-api, standard plan)", async () => {
      await createProduct(page, "Marketplace", "Pet and user management APIs");
      await configureProduct(page, ["pets-api", "users-api"], /standard/);
    });

    await test.step("Deploy Marketplace to prod", async () => {
      await deployProduct(page, "Marketplace", "prod");
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Marketplace deployment invoke URL", async () => {
      await verifyDeployment(page, "Marketplace");
    });

    await test.step("Create consumer: Consumer A (Marketplace)", async () => {
      await createConsumerForProduct(page, "Consumer A", "Marketplace", /standard/);
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Consumer A token URL and invoke URL", async () => {
      await verifyConsumerUrls(page, "Consumer A", "Marketplace", "/pet/findByStatus?status=available");
    });

    // ── 13. Product 2: Commerce (users + stores, premium plan) ────────────
    await test.step("Create product: Commerce (users-api + stores-api, premium plan)", async () => {
      await createProduct(page, "Commerce", "User and store operations");
      await configureProduct(page, ["users-api", "stores-api"], /premium/);
    });

    await test.step("Deploy Commerce to prod", async () => {
      await deployProduct(page, "Commerce", "prod");
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Commerce deployment invoke URL", async () => {
      await verifyDeployment(page, "Commerce");
    });

    await test.step("Create consumer: Consumer B (Commerce)", async () => {
      await createConsumerForProduct(page, "Consumer B", "Commerce", /premium/);
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Consumer B token URL and invoke URL", async () => {
      await verifyConsumerUrls(page, "Consumer B", "Commerce", "/user/login?username=test&password=test");
    });

    // ── 14. Product 3: Pet Catalog (pets only, standard plan) ─────────────
    await test.step("Create product: Pet Catalog (pets-api only, standard plan)", async () => {
      await createProduct(page, "Pet Catalog", "Browse and manage pets");
      await configureProduct(page, ["pets-api"], /standard/);
    });

    await test.step("Deploy Pet Catalog to prod", async () => {
      await deployProduct(page, "Pet Catalog", "prod");
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Pet Catalog deployment invoke URL", async () => {
      await verifyDeployment(page, "Pet Catalog");
    });

    await test.step("Create consumer: Consumer C (Pet Catalog)", async () => {
      await createConsumerForProduct(page, "Consumer C", "Pet Catalog", /standard/);
    });

    await page.waitForTimeout(10_000);

    await test.step("Verify Consumer C token URL and invoke URL", async () => {
      await verifyConsumerUrls(page, "Consumer C", "Pet Catalog", "/pet/findByStatus?status=available");
    });
  });
});
