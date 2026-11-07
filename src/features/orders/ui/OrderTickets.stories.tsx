import preview from "../../../../.storybook/preview";
import { OrderTickets } from "./OrderTickets.tsx";

const meta = preview.meta({ title: "Orders/OrderTickets", component: OrderTickets });

/** Three customers, one about to leave. */
export const Rush = meta.story({
  args: {
    tickets: [
      { id: 1, name: "Döner Classic", icon: "🥙", fillings: ["meat", "lettuce", "onion", "garlic"], patience: 0.9 },
      { id: 2, name: "Dürüm Scharf", icon: "🌯", fillings: ["meat", "lettuce", "tomato", "spicy"], patience: 0.45 },
      { id: 3, name: "Döner Pur", icon: "🥙", fillings: ["meat", "garlic"], patience: 0.12 },
    ],
  },
});

/** Nobody waiting. */
export const Empty = meta.story({ args: { tickets: [] } });
