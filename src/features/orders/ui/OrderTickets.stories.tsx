import preview from "../../../../.storybook/preview";
import { OrderTickets } from "./OrderTickets.tsx";

const meta = preview.meta({ title: "Orders/OrderTickets", component: OrderTickets });

/** Three customers, one about to leave. */
export const Rush = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Döner Classic", icon: "🥙", base: "bread", fillings: ["meat", "lettuce", "onion", "garlic"], patience: 0.9 },
      { id: 2, name: "Dürüm Scharf", icon: "🌯", base: "wrap", fillings: ["meat", "lettuce", "tomato", "spicy"], patience: 0.45 },
      { id: 3, name: "Döner Pur", icon: "🥙", base: "bread", fillings: ["meat", "garlic"], patience: 0.12 },
    ],
  },
});

/** The bakery: dough goes in the oven, each pastry takes one topping. */
export const Backstube = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Franzbrötchen", icon: "🥐", base: "dough", fillings: ["cinnamon"], patience: 0.8 },
      { id: 2, name: "Brezel", icon: "🥨", base: "dough", fillings: ["lye"], patience: 0.4 },
      { id: 3, name: "Veggie Döner", icon: "🥙", base: "bread", fillings: ["lettuce", "tomato", "onion", "herb"], patience: 0.2 },
    ],
  },
});

/** Nobody waiting. */
export const Empty = meta.story({ args: { tickets: [] } });
