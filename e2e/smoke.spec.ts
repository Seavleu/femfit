import { test, expect } from "@playwright/test";

/**
 * Browse → cart → COD path smoke (auth-gated checkout stops at sign-in).
 * Full admin ship flow needs seeded credentials + env — covered as optional skip.
 */
test.describe("storefront smoke", () => {
  test("browse catalog and open a product", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FEMFIT").first()).toBeVisible();

    // Prefer a seeded PDP slug; fall back to first product card link
    await page.goto("/products/compression-leggings-pro");
    if (page.url().includes("compression-leggings-pro")) {
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
      return;
    }

    await page.goto("/products");
    const productLink = page
      .locator('a[href^="/products/"]')
      .filter({ has: page.locator("img") })
      .first();
    await expect(productLink).toBeVisible({ timeout: 30_000 });
    await productLink.click();
    await expect(page).toHaveURL(/\/products\/[^/?]+/, { timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("checkout requires sign-in", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("help and size guide stubs load", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
    await page.goto("/size-guide");
    await expect(page.getByRole("heading", { name: "Size guide" })).toBeVisible();
    await page.goto("/returns");
    await expect(
      page.getByRole("heading", { name: /Returns/i })
    ).toBeVisible();
  });
});

test.describe("authenticated COD path", () => {
  test.skip(
    !process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD,
    "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run authenticated checkout"
  );

  test("dev customer can reach checkout with saved flow", async ({ page }) => {
    await page.goto("/sign-in");
    // Dev login buttons when NEXT_PUBLIC_ENABLE_DEV_LOGIN / development
    const dev1 = page.getByRole("button", { name: /dev1/i });
    if (await dev1.isVisible().catch(() => false)) {
      await dev1.click();
    } else {
      await page.fill('input[type="email"]', process.env.E2E_CUSTOMER_EMAIL!);
      await page.fill(
        'input[type="password"]',
        process.env.E2E_CUSTOMER_PASSWORD!
      );
      await page.getByRole("button", { name: /sign in|continue/i }).click();
    }
    await page.waitForURL((url) => !url.pathname.includes("sign-in"), {
      timeout: 30_000,
    });

    await page.goto("/products");
    const productLink = page.locator('a[href^="/products/"]').first();
    await productLink.click();
    const addBtn = page.getByRole("button", { name: /add to cart/i });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Cash on Delivery/i)).toBeVisible();
  });
});
