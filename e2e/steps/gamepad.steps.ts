import { expect } from "@playwright/test";
import { Given, Then, When } from "../fixtures.ts";

/** The fake pad's live state, which the stubbed `navigator.getGamepads` reads on every poll. */
interface FakePad {
  axes: number[];
  buttons: boolean[];
}

declare global {
  interface Window {
    __pad?: FakePad;
  }
}

Given("a gamepad is plugged in", async ({ page }) => {
  await page.addInitScript(() => {
    const pad: FakePad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => false) };
    window.__pad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [{
        id: "Fake standard pad",
        index: 0,
        connected: true,
        mapping: "standard",
        timestamp: performance.now(),
        axes: [...pad.axes],
        buttons: pad.buttons.map((pressed) => ({ pressed, touched: pressed, value: Number(pressed) })),
        vibrationActuator: null,
      }],
    });
  });
});

When("the gamepad pushes the stick right for {int} ms", async ({ page }, ms: number) => {
  await page.evaluate(() => {
    if (window.__pad) window.__pad.axes[0] = 1;
  });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    if (window.__pad) window.__pad.axes[0] = 0;
  });
});

Then("the controls show the pad buttons for cook {int}", async ({ page }, id: number) => {
  await expect(page.locator("footer span").filter({ hasText: `Koch ${id}` })).toContainText("Stick laufen");
});
