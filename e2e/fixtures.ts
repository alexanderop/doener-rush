import { expect } from "@playwright/test";
import { createBdd, test as base } from "playwright-bdd";

export const test = base.extend<{ failOnPageErrors: void }>({
  // every scenario fails on an uncaught error or console.error in the page
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await use();
      expect(errors, "errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export const { Given, When, Then, Step } = createBdd(test);
