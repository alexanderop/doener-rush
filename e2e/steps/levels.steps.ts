import { expect } from "@playwright/test";
import { Given, Then, When } from "../fixtures.ts";

Given("a fresh campaign where {string} is locked", async ({ page }, name: string) => {
  await page.goto("/");
  await expect(page.getByRole("radio", { name: `${name}, gesperrt` })).toBeDisabled();
});

When("I play level {string} and end the shift with {int} points", async ({ page }, level: string, score: number) => {
  await page.goto(`/play?level=${level}&humans=1&bots=0`);
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate((points) => {
    const world = window.__game?.world();

    if (world === undefined) return;
    world.orders.score = points;
    world.tick = world.endTick - 1;
    window.__game?.step(1);
  }, score);
  await expect(page.getByTestId("final-score")).toHaveText(`${score} Punkte`);
});

Then("the end-of-shift card says {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("dialog", { name: "Feierabend" }).getByText(text)).toBeVisible();
});

When("I go back to the home page", async ({ page }) => {
  await page.goto("/");
});

Then("{string} can be picked", async ({ page }, name: string) => {
  await expect(page.getByRole("radio", { name: new RegExp(`^${name}, \\d von 3 Sternen$`) })).toBeEnabled();
});

Then("{string} shows a record of {int}", async ({ page }, name: string, score: number) => {
  await expect(page.getByRole("radio", { name: new RegExp(`^${name}`) })).toContainText(`Rekord ${score}`);
});

When("I press {string}", async ({ page }, label: string) => {
  await page.getByRole("button", { name: label }).click();
});

Then("the shift runs in level {string}", async ({ page }, level: string) => {
  await expect(page).toHaveURL(new RegExp(`level=${level}`));
  await expect.poll(() => page.evaluate(() => window.__game?.world().width)).toBe(13);
});
