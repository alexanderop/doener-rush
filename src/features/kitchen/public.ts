export type { Base, CrateGoods, Filling, Item, Sauce, Station, Veg } from "./model.ts";

export {
  BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, ICONS, LABEL, SHAVE_TICKS, START_PLATES, TOAST_BURNT, TOAST_DONE,
  TRAY_PORTIONS, WASH_TICKS,
} from "./prototypes.ts";

export {
  interact, isBurntBase, isChopped, newSpit, spreadFire, stepStation, work,
} from "./simulation.ts";
