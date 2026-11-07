export type { Base, CrateGoods, Filling, Item, Sauce, Station, Veg } from "./model.ts";

export {
  BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, HEAT, ICONS, LABEL, SHAVE_TICKS, START_PLATES, TRAY_PORTIONS, WASH_TICKS,
} from "./prototypes.ts";

export {
  interact, isBaked, isBurntBase, isChopped, isThrowable, keepFromBurning, land, newSpit, spreadFire, stepStation, work,
} from "./simulation.ts";
