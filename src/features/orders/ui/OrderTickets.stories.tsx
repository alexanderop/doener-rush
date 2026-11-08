import preview from "../../../../.storybook/preview";
import { OrderTickets } from "./OrderTickets.tsx";

const meta = preview.meta({ title: "Orders/OrderTickets", component: OrderTickets });

/** Three customers, one about to leave. */
export const Rush = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Döner Classic", icon: "🥙", base: "bread", fillings: ["meat", "lettuce", "onion", "garlic"], table: null, patience: 0.9 },
      { id: 2, name: "Dürüm Scharf", icon: "🌯", base: "wrap", fillings: ["meat", "lettuce", "tomato", "spicy"], table: null, patience: 0.45 },
      { id: 3, name: "Döner Pur", icon: "🥙", base: "bread", fillings: ["meat", "garlic"], table: null, patience: 0.12 },
    ],
  },
});

/** The bakery: dough goes in the oven, each pastry takes one topping. */
export const Backstube = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Franzbrötchen", icon: "🥐", base: "dough", fillings: ["cinnamon"], table: null, patience: 0.8 },
      { id: 2, name: "Brezel", icon: "🥨", base: "dough", fillings: ["lye"], table: null, patience: 0.4 },
      { id: 3, name: "Veggie Döner", icon: "🥙", base: "bread", fillings: ["lettuce", "tomato", "onion", "herb"], table: null, patience: 0.2 },
    ],
  },
});

/** The dining room: each ticket says which table its guest sits at. */
export const Gastraum = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Döner Classic", icon: "🥙", base: "bread", fillings: ["meat", "lettuce", "onion", "garlic"], table: 3, patience: 0.85 },
      { id: 2, name: "Dürüm Scharf", icon: "🌯", base: "wrap", fillings: ["meat", "lettuce", "tomato", "spicy"], table: 1, patience: 0.4 },
      { id: 3, name: "Döner Pur", icon: "🥙", base: "bread", fillings: ["meat", "garlic"], table: 6, patience: 0.15 },
    ],
  },
});

/** Nobody waiting. */
export const Empty = meta.story({ args: { tickets: [] } });
