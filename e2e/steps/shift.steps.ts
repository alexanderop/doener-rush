import { expect } from "@playwright/test";
import { Given, Then, When } from "../fixtures.ts";

interface CookPosition {
  readonly x: number;
  readonly y: number;
}

const start = new WeakMap<object, CookPosition>();

async function cookAt(page: import("@playwright/test").Page, id: number): Promise<CookPosition> {
  await page.waitForFunction((i) => window.__game?.world().cooks[i - 1] !== undefined, id);

  return page.evaluate((i) => {
    const cook = window.__game?.world().cooks[i - 1];

    return { x: cook?.x ?? 0, y: cook?.y ?? 0 };
  }, id);
}

Given("the scenario {string}", async ({ page }, name: string) => {
  await page.goto(`/play?scenario=${name}`);
  await page.waitForFunction(() => window.__game !== undefined);
  start.set(page, await cookAt(page, 1));
});

When("player {int} presses {string}", async ({ page }, _player: number, key: string) => {
  await page.keyboard.press(key);
});

When("player {int} holds {string} for {int} ms", async ({ page }, _player: number, key: string, ms: number) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
});

When("{int} seconds pass", async ({ page }, s: number) => {
  await page.evaluate((ticks) => window.__game?.step(ticks), s * 60);
});

Then("the score is {int}", async ({ page }, score: number) => {
  await expect(page.getByTestId("score")).toHaveText(String(score));
});

Then("the score is more than {int}", async ({ page }, score: number) => {
  await expect.poll(async () => Number(await page.getByTestId("score").textContent())).toBeGreaterThan(score);
});

Then("no ticket is waiting", async ({ page }) => {
  await expect(page.getByText("Keine Bestellungen")).toBeVisible();
});

Then("the tickets name the tables {int} and {int}", async ({ page }, a: number, b: number) => {
  const rail = page.getByRole("list", { name: "Bestellungen" });
  await expect(rail.getByRole("img", { name: `Tisch ${a}`, exact: true })).toBeVisible();
  await expect(rail.getByRole("img", { name: `Tisch ${b}`, exact: true })).toBeVisible();
});

Then("only the ticket for table {int} is waiting", async ({ page }, table: number) => {
  const rail = page.getByRole("list", { name: "Bestellungen" });
  await expect(rail.getByRole("img", { name: /^Tisch \d+$/ })).toHaveCount(1);
  await expect(rail.getByRole("img", { name: `Tisch ${table}`, exact: true })).toBeVisible();
});

Then("cook {int} has moved right", async ({ page }, id: number) => {
  const before = start.get(page);
  const after = await cookAt(page, id);
  expect(after.x).toBeGreaterThan((before?.x ?? 0) + 1);
});

Then("the end-of-shift card shows {int} points", async ({ page }, score: number) => {
  await expect(page.getByRole("dialog", { name: "Feierabend" })).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText(`${score} Punkte`);
});

When("player {int} holds {string} for {int} ms while pressing {string}", async ({ page }, _player: number, key: string, ms: number, tap: string) => {
  await page.keyboard.down(key);
  await page.keyboard.press(tap);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
});

Then("cook {int} holds a {string}", async ({ page }, id: number, veg: string) => {
  await expect.poll(() => page.evaluate((i) => {
    const held = window.__game?.world().cooks[i - 1]?.held;

    return held?.kind === "veg" ? held.veg : held?.kind;
  }, id)).toBe(veg);
});

Then("cook {int} holds nothing", async ({ page }, id: number) => {
  await expect.poll(() => page.evaluate((i) => window.__game?.world().cooks[i - 1]?.held, id)).toBeNull();
});

Then("the spit is not burning", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => [...(window.__game?.world().stations.values() ?? [])].find((s) => s.type === "spit")?.fire.state)).toBe("out");
});

Given("a shift with {int} players and {int} bots", async ({ page }, humans: number, bots: number) => {
  await page.goto(`/play?humans=${humans}&bots=${bots}`);
  await page.waitForFunction(() => window.__game !== undefined);
});

Then("the controls show {int} bots", async ({ page }, bots: number) => {
  await expect(page.getByText("Bot · kocht von allein")).toHaveCount(bots);
});

const swapStart = new WeakMap<object, CookPosition>();

Given("a solo shift with two cooks to swap", async ({ page }) => {
  // a named scenario skips the opening countdown, so the keys act at once
  await page.goto("/play?scenario=shift&humans=1&bots=0&swap=1");
  await page.waitForFunction(() => window.__game !== undefined);
  swapStart.set(page, await cookAt(page, 2));
});

Then("the controls say cook {int} is yours", async ({ page }, id: number) => {
  await expect(page.locator("footer span").filter({ hasText: `Koch ${id}` })).toContainText("Du ·");
});

Then("cook {int} has moved right since the start", async ({ page }, id: number) => {
  const after = await cookAt(page, id);
  expect(after.x).toBeGreaterThan((swapStart.get(page)?.x ?? 0) + 1);
});

Then("the countdown shows {string}", async ({ page }, text: string) => {
  await expect(page.getByTestId("countdown")).toHaveText(text);
});

Then("the kitchen has not started", async ({ page }) => {
  expect(await page.evaluate(() => window.__game?.world().tick)).toBe(0);
});

Then("the kitchen is running", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.__game?.world().tick ?? 0)).toBeGreaterThan(30);
  await expect(page.getByTestId("countdown")).toHaveCount(0);
});
