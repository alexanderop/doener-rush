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

Then("the spit is not burning", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => [...(window.__game?.world().stations.values() ?? [])].find((s) => s.type === "spit")?.fire)).toBe(0);
});
