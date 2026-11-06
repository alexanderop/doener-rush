import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { OrdersSnapshot } from "../../features/orders/public.ts";
import { snapshotAtom } from "./atoms.ts";

/** The orders slot of the HUD snapshot, or none until the first one is taken. Feature UIs read this. */
export const ordersAtom = Atom.make((get) => Option.map(get(snapshotAtom), (snap): OrdersSnapshot => snap.orders));
