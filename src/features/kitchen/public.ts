export type { Base, Bowl, CrateGoods, Dry, Filling, Item, Sauce, Station, Topping, Veg } from "./model.ts";

export {
  BURNT, CHOP_TICKS, COOKED, DOUSE_TICKS, HEAT, ICONS, LABEL, MIX_TICKS, SHAVE_TICKS, START_PLATES, TRAY_PORTIONS, WASH_TICKS,
} from "./prototypes.ts";

export {
  interact, isBaked, isBurntBase, isChopped, isThrowable, keepFromBurning, land, newSpit, spreadFire, stepStation, work,
} from "./simulation.ts";
