export type { Family } from "./prototypes.ts";

export type { Base, Bowl, CrateGoods, Dry, Filling, Item, Sauce, Station, Topping, Veg } from "./model.ts";

export {
  BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, DRY, FAMILY, HEAT, ICONS, LABEL, MIX_TICKS, SHAVE_TICKS, START_PLATES, TRAY_PORTIONS, WASH_TICKS,
} from "./prototypes.ts";

export {
  accepts, interact, isBaked, isBurntBase, isChopped, isThrowable, keepFromBurning, land, newSpit, spreadFire, stepStation, work,
} from "./simulation.ts";

export { OUT, dousing, ignite, isBurning } from "./machines/fire.ts";

export { RAW, heatTicks, toastAt } from "./machines/toast.ts";

export { CHOPPED, WHOLE, cutTicks } from "./machines/cut.ts";

export { DIRTY, EMPTY, foodOn } from "./machines/plate.ts";

export { sideAt } from "./machines/side.ts";
