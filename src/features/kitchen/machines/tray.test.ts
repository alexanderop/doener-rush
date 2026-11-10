import { describe, expect, it } from "vitest";
import { TRAY_PORTIONS } from "../prototypes.ts";
import type { Tray } from "./tray.ts";
import { NO_STOCK, portionsIn, stock, takePortion, takesPortion, trayOf, vegIn } from "./tray.ts";

/** A tray stocked with onion until it takes no more. */
function full(): Tray {
  let tray = NO_STOCK;

  for (let i = 0; i < TRAY_PORTIONS + 2; i++) tray = stock(tray, "onion");

  return tray;
}

describe("tray", () => {
  it("takes portions of one vegetable up to TRAY_PORTIONS", () => {
    expect(full()).toEqual({ state: "stocked", veg: "onion", portions: TRAY_PORTIONS });
    expect(takesPortion(full(), "onion")).toBe(false);
  });

  it("refuses a different vegetable while stocked", () => {
    const tray = stock(NO_STOCK, "onion");

    expect(takesPortion(tray, "tomato")).toBe(false);
    expect(stock(tray, "tomato")).toBe(tray);
  });

  it("is empty again after the last portion, and then takes any vegetable", () => {
    const tray = takePortion(takePortion(trayOf("lettuce", 2)));

    expect(tray).toBe(NO_STOCK);
    expect(vegIn(tray)).toBeNull();
    expect(portionsIn(tray)).toBe(0);
    expect(vegIn(stock(tray, "tomato"))).toBe("tomato");
  });

  it("stays empty when a portion is taken from an empty tray", () => {
    expect(takePortion(NO_STOCK)).toBe(NO_STOCK);
  });
});
