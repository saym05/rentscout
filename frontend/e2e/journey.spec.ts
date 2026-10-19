import { expect, test, type Page } from "@playwright/test";
import { Backend } from "./backend";

/** Collects console errors and failed requests; every test asserts there were none (unless expected). */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => { if (!r.url().includes("fonts.")) problems.push(`failed: ${r.url()}`); });
  return problems;
}

const cards = (page: Page) => page.getByRole("article");
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: "Filters" });
  if (await toggle.isVisible()) await toggle.click();
}

test.describe("full journey on the real backend + SQLite", () => {
  const backend = new Backend();
  test.beforeAll(async () => { await backend.start(); });
  test.afterAll(async () => { await backend.stop(); });

  test("search, filter, sort, open, favorite, compare, refresh, restart, persistence", async ({ page }, info) => {
    const problems = watch(page);
    const city = info.project.name === "mobile" ? "London" : "Toronto"; // projects share one DB; keep their data apart

    // 1. landing → search by city
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText("marked DEMO are sample data");
    await page.getByLabel("City").fill(city);
    await page.getByRole("button", { name: "Search rentals" }).click();
    await expect(page).toHaveURL(new RegExp(`city=${city}`));
    await expect(cards(page).first()).toContainText(city);
    const total = Number((await page.getByRole("heading", { level: 1 }).textContent())!.split(" ")[0]);
    expect(total).toBe(9);

    // 2. filter by type
    await openFilters(page);
    await page.getByRole("checkbox", { name: "Apartment" }).check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/propertyTypes=apartment/);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(`${total} listings`);
    for (const c of await cards(page).all()) await expect(c.locator(".card-photo")).toHaveText("Apartment");

    // 3. sort lowest first
    await page.getByLabel("Sort by").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    const prices = await page.locator(".price-total").allTextContents();
    const nums = prices.map((p) => Number(p.replace(/\/ month|[^0-9.]/g, "")));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));

    // 4. compare the two cheapest
    await page.getByRole("checkbox", { name: "Compare" }).nth(0).check();
    await page.getByRole("checkbox", { name: "Compare" }).nth(1).check();

    // 5. open the first listing and favorite it
    const firstTitle = (await cards(page).first().getByRole("heading").textContent())!;
    await cards(page).first().getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstTitle);
    await expect(page.getByRole("heading", { name: "Monthly cost" })).toBeVisible();
    await page.getByRole("button", { name: `Save ${firstTitle}` }).click();
    await expect(page.getByRole("button", { name: `Remove ${firstTitle} from saved` })).toHaveAttribute("aria-pressed", "true");

    // 6. compare page shows both and a cheapest marker
    await page.getByRole("link", { name: /Compare/ }).click();
    await expect(page.getByRole("heading", { name: "Compare 2 listings" })).toBeVisible();
    await expect(page.getByText("Cheapest").first()).toBeVisible();

    // 7. add a manual listing
    await page.getByRole("link", { name: "Add" }).click();
    const mine = `E2E room ${info.project.name}`;
    await page.getByLabel("Title").fill(mine);
    await page.getByLabel("City", { exact: true }).fill(city);
    await page.getByLabel("Neighborhood").fill("Test Quarter");
    await page.getByLabel("Rent", { exact: true }).fill("200");
    await page.getByLabel("Per").selectOption("week");
    await page.getByRole("button", { name: "Add listing" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(mine);
    await expect(page.getByText("Added by you")).toBeVisible();

    // 8. refresh sources
    await page.getByRole("link", { name: "Sources" }).click();
    await page.getByRole("button", { name: "Refresh sources" }).click();
    await expect(page.getByText("Refresh finished: all sources OK.")).toBeVisible();
    await expect(page.getByRole("listitem", { name: /Demo Source A/ })).toContainText("OK");

    // 9. restart the backend (same SQLite file)
    await backend.restart();

    // 10. everything persisted
    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: firstTitle })).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent(mine)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 listing");
    await page.goto("/sources");
    await expect(page.getByRole("listitem", { name: /Demo Source A/ })).toContainText("OK");

    expect(problems).toEqual([]);
  });

  test("validation and not-found states come from the backend", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/search?minPrice=-5");
    await expect(page.getByRole("alert")).toContainText("minPrice");
    await page.goto("/listings/does-not-exist");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(problems.filter((p) => !p.includes("404") && !p.includes("400"))).toEqual([]);
  });

  test("no horizontal page scroll on any main page", async ({ page }) => {
    for (const path of ["/", "/search", "/listings/demo-berlin-2", "/saved", "/sources", "/listings/new", "/compare"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("backend down and partial source failure", () => {
  test("shows a clear error when the backend is unreachable", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("alert")).toContainText("Cannot reach the RentScout server");
  });

  test("a failing source is reported and listings are kept", async ({ page }) => {
    const backend = new Backend({ RENTSCOUT_FAILING_SOURCES: "demo-b" });
    await backend.start();
    try {
      await page.goto("/sources");
      await page.getByRole("button", { name: "Refresh sources" }).click();
      await expect(page.getByText(/1 source\(s\) failed; stored listings were kept/)).toBeVisible();
      const b = page.getByRole("listitem", { name: /Demo Source B/ });
      await expect(b).toContainText("Failed");
      await expect(b).toContainText(/Listings stored\s*12/);
    } finally { await backend.stop(); }
  });
});
