import { test, expect } from "@playwright/test"
import { readFileSync } from "fs"
import { resolve } from "path"

const EMAIL    = `smoke+${Date.now()}@mailinator.com`
const PASSWORD = "Playwright@2025!"

const PETS_YAML = readFileSync(resolve("tests/e2e/fixtures/pets-api.yaml"), "utf-8")

// ── Helpers ────────────────────────────────────────────────────────────────

async function selectOption(
  page: import("@playwright/test").Page,
  placeholder: string,
  optionText: string | RegExp,
) {
  await page.getByText(placeholder).click()
  await page.getByRole("option", { name: optionText }).click()
}

async function createApi(
  page: import("@playwright/test").Page,
  name: string,
  scope: string,
  yaml: string,
) {
  await page.goto("/apis/new")
  await page.waitForLoadState("domcontentloaded")
  await expect(page.locator("#yaml")).toBeVisible()
  await page.locator("#name").fill(name)
  await page.locator("#scope").fill(scope)
  await page.locator("#yaml").click({ clickCount: 3 })
  await page.locator("#yaml").press("Control+a")
  await page.locator("#yaml").fill(yaml)
  await page.getByRole("button", { name: "Save API" }).click()
  await page.waitForURL("**/apis", { timeout: 30_000 }).catch(async () => {
    const err = await page.locator(".text-destructive").textContent().catch(() => "")
    throw new Error(`API "${name}" creation failed: "${err?.trim()}"`)
  })
  await expect(page.getByText(name)).toBeVisible()
}

async function createProduct(
  page: import("@playwright/test").Page,
  displayName: string,
  description: string,
) {
  await page.goto("/products/new")
  await page.locator("#displayName").fill(displayName)
  await page.locator("#description").fill(description)
  await page.getByRole("button", { name: "Create Product" }).click()
  await page.waitForURL("**/products/**", { timeout: 10_000 })
}

async function configureProduct(
  page: import("@playwright/test").Page,
  apiNames: string[],
  planPattern: string | RegExp,
) {
  await page.getByRole("button", { name: "APIs" }).click()
  for (const name of apiNames) {
    await selectOption(page, "Select an API…", name)
    await page.getByRole("button", { name: "Add" }).click()
    await expect(page.getByRole("cell", { name }).first()).toBeVisible()
  }
  await page.getByRole("button", { name: "Plans" }).click()
  await selectOption(page, "Select a plan…", planPattern)
  await page.getByRole("button", { name: "Add" }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await page.waitForLoadState("networkidle", { timeout: 15_000 })
}

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

async function createConsumer(
  page: import("@playwright/test").Page,
  consumerName: string,
  productName: string | RegExp,
  planPattern: string | RegExp,
) {
  await page.goto("/consumers/new")
  await page.waitForLoadState("domcontentloaded")
  await page.locator("#name").fill(consumerName)
  await selectOption(page, "Select a product…", productName)
  await selectOption(page, "Select a stage…", "prod")
  await selectOption(page, "Select a plan…", planPattern)
  await page.getByRole("button", { name: "Save Consumer" }).click()
  await page.waitForURL("**/consumers", { timeout: 30_000 })
  await expect(page.getByText(consumerName)).toBeVisible()
}

// ── Test ───────────────────────────────────────────────────────────────────

test.describe("Smoke — minimal end-to-end flow", () => {
  test.setTimeout(600_000)

  test("1 api · 1 env · 1 plan · 1 product · 1 consumer · curl verify", async ({ page }) => {
    // 1. Sign up
    await test.step("Sign up", async () => {
      await page.goto("/login?mode=signup")
      await page.getByLabel("First name").fill("Smoke")
      await page.getByLabel("Last name").fill("Test")
      await page.getByLabel("Email").fill(EMAIL)
      await page.getByLabel("Password").fill(PASSWORD)
      await page.getByRole("button", { name: "Create Account" }).click()
      await page.waitForURL("**/gateway", { timeout: 10_000 })
    })

    // 2. Create gateway
    await test.step("Create gateway", async () => {
      await page.getByLabel("Gateway name").fill("smoke-gateway")
      await page.getByRole("button", { name: "Create Gateway" }).click()
      await page.waitForURL(/\/$/, { timeout: 50_000 })
      await expect(page.getByText("smoke-gateway")).toBeVisible()
    })

    // 3. Create pets API
    await test.step("Create API: pets-api", async () => {
      await createApi(page, "pets-api", "pets", PETS_YAML)
    })
    await page.waitForTimeout(10_000)

    // 4. Create prod environment
    await test.step("Create environment: prod", async () => {
      await page.goto("/environments")
      await page.getByRole("button", { name: "Add" }).click()
      await page.locator("#env-name").fill("prod")
      await page.getByRole("button", { name: "Create" }).click()
      await expect(page.getByRole("cell", { name: "prod" })).toBeVisible({ timeout: 10_000 })
    })
    await page.waitForTimeout(10_000)

    // 5. Create standard plan
    await test.step("Create plan: standard", async () => {
      await page.goto("/plans")
      await page.getByRole("button", { name: "Add" }).click()
      await page.locator("#plan-name").fill("standard")
      await page.locator("#plan-throttle").fill("100")
      await page.locator("#plan-burst").fill("200")
      await page.getByPlaceholder("e.g. 100000").fill("50000")
      await page.getByRole("button", { name: "Create" }).click()
      await expect(page.getByText("standard")).toBeVisible({ timeout: 10_000 })
    })
    await page.waitForTimeout(10_000)

    // 6. Create product, attach API + plan, deploy to prod
    await test.step("Create product: Pet Store", async () => {
      await createProduct(page, "Pet Store", "Pets API product")
      await configureProduct(page, ["pets-api"], /standard/)
    })

    await test.step("Deploy Pet Store to prod", async () => {
      await deployProduct(page, "Pet Store", "prod")
    })
    await page.waitForTimeout(10_000)

    // 7. Create consumer
    await test.step("Create consumer: Consumer A", async () => {
      await createConsumer(page, "Consumer A", "Pet Store", /standard/)
    })
    await page.waitForTimeout(10_000)

    // 8. Read credentials + curl verify
    await test.step("Verify: get token then call invoke URL", async () => {
      // Navigate to consumer detail to read clientId + tokenUrl
      await page.goto("/consumers")
      await page.waitForLoadState("domcontentloaded")
      const row = page.getByRole("row").filter({ hasText: "Consumer A" })
      await row.locator('[aria-haspopup="menu"]').click()
      await page.getByRole("menuitem", { name: "Edit" }).click()
      await page.waitForURL("**/consumers/**")

      const consumerId  = page.url().split("/").pop()!
      const clientId    = (await page.getByTestId("client-id").textContent())!.trim()
      const tokenUrl    = (await page.getByTestId("token-url").textContent())!.trim()

      // Fetch client secret
      const secretRes   = await page.request.get(`/api/consumer-secret/${consumerId}`)
      const { secret: clientSecret } = await secretRes.json()

      // Read invoke URL from product Deployments tab
      await page.goto("/products")
      await page.waitForLoadState("domcontentloaded")
      await page.getByRole("link", { name: "Pet Store" }).click()
      await page.waitForURL("**/products/**")
      await page.getByRole("button", { name: "Deployments" }).click()
      await expect(page.getByTestId("invoke-url")).toBeVisible({ timeout: 10_000 })
      const invokeUrl = (await page.getByTestId("invoke-url").textContent())!.trim()

      // POST token endpoint (client credentials)
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
      const tokenRes = await page.request.post(tokenUrl, {
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type":  "application/x-www-form-urlencoded",
        },
        form: { grant_type: "client_credentials" },
      })
      expect(tokenRes.status()).toBe(200)
      const { access_token } = await tokenRes.json()

      // GET pets endpoint with API key = clientId + Bearer token
      const invokeRes = await page.request.get(
        `${invokeUrl}/pet/findByStatus?status=available`,
        {
          headers: {
            "x-api-key":     clientId,
            "Authorization": `Bearer ${access_token}`,
          },
        },
      )
      expect(invokeRes.status()).toBe(200)
    })
  })
})
