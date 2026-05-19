import { test, expect } from "@playwright/test"

test.describe("Login page", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })

  test("renders sign-in form by default", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("ApiGateway")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    // Forgot password link only visible in sign-in mode
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible()
  })

  test("switches to sign-up mode via tab", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: "Sign Up" }).click()
    await expect(page).toHaveURL(/mode=signup/)
    await expect(page.getByLabel("First name")).toBeVisible()
    await expect(page.getByLabel("Last name")).toBeVisible()
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible()
    // Forgot password link should NOT appear in signup mode
    await expect(page.getByRole("link", { name: "Forgot password?" })).not.toBeVisible()
  })

  test("shows error when submitting empty form", async ({ page }) => {
    await page.goto("/login")
    // Clear the required attributes so the browser doesn't block the submit
    await page.evaluate(() => {
      document.querySelectorAll("input[required]").forEach((el) => el.removeAttribute("required"))
    })
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByText("Email and password are required")).toBeVisible()
  })

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("wrong@example.com")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.getByRole("button", { name: "Sign In" }).click()
    // Should stay on login and show an error message
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator(".text-destructive")).toBeVisible()
  })

  test("sign-up tab renders password hint", async ({ page }) => {
    await page.goto("/login?mode=signup")
    await expect(
      page.getByText("Min 8 characters with uppercase, lowercase, number, and symbol")
    ).toBeVisible()
  })
})
