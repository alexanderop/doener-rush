import { expect } from "@playwright/test";
import { Then, When } from "../fixtures.ts";

const picker = '[aria-label="Aussehen Dein Koch"]';

When("I flip my cook to the next look", async ({ page }) => {
  // the portrait appears once the page is hydrated and the arrows answer
  await page.locator(`${picker} img`).waitFor();
  await page.getByRole("button", { name: "Dein Koch: nächster Look" }).click();
});

Then("my cook is {string}", async ({ page }, name: string) => {
  await expect(page.locator(`${picker} output`)).toHaveText(name);
});

When("I start the shift", async ({ page }) => {
  await page.getByRole("link", { name: "Schicht starten" }).click();
  await page.waitForFunction(() => window.__game !== undefined);
});

Then("the shift dresses player 1 as {string}", async ({ page }, look: string) => {
  await expect(page).toHaveURL(new RegExp(`look1=${look}`));
});
