import { expect } from "@playwright/test";
import { Given, Then, When } from "../fixtures.ts";

Given("the home page", async ({ page }) => {
  await page.goto("/");
});

When("the player opens the tutorial", async ({ page }) => {
  await page.getByRole("link", { name: "Tutorial" }).click();
  await page.waitForFunction(() => window.__game !== undefined);
});

Given("the tutorial", async ({ page }) => {
  await page.goto("/tutorial");
  await page.waitForFunction(() => window.__game !== undefined);
});

Then("the tutorial shows step {int} {string}", async ({ page }, step: number, title: string) => {
  await expect(page.getByTestId("tutorial-title")).toHaveText(title);
  await expect(page.getByTestId("tutorial-step")).toContainText(`Schritt ${step} von`);
});
