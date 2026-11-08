import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { ordersAtom } from "../../../game/runtime/client.ts";
import { OrderTickets } from "./OrderTickets.tsx";
import type { OrderEvent } from "../public.ts";
import type { TicketView } from "../snapshot.ts";
import type { LeavingTicket } from "./OrderTickets.tsx";

/** Long enough for the slowest exit animation and the points pop. */
const EXIT_MS = 1150;

/** Why a ticket left, read from the event the sim logged for it; none when the round was simply reset. */
function leavingFrom(ticket: TicketView, index: number, events: readonly OrderEvent[]): Option.Option<LeavingTicket> {
  for (const event of events) {
    if (event.type === "served" && event.orderId === ticket.id) {
      return Option.some({ ticket, index, outcome: "served", points: event.points + event.tip, tip: event.tip });
    }

    if (event.type === "expired" && event.orderId === ticket.id) {
      return Option.some({ ticket, index, outcome: "expired", points: -event.penalty, tip: 0 });
    }
  }

  return Option.none();
}

/** Tickets that vanished from the snapshot since the last one, held for their exit animation. */
function useLeavingTickets(tickets: readonly TicketView[], events: readonly OrderEvent[]): readonly LeavingTicket[] {
  const previous = useRef<readonly TicketView[]>([]);
  const [leaving, setLeaving] = useState<readonly LeavingTicket[]>([]);

  useEffect(() => {
    const present = new Set(tickets.map((t) => t.id));
    const gone = previous.current.flatMap((t, index) => (present.has(t.id) ? [] : Option.toArray(leavingFrom(t, index, events))));
    previous.current = tickets;

    if (gone.length === 0) return;
    setLeaving((list) => [...list, ...gone]);
    // no cleanup: the effect re-runs on every snapshot, and the exit must still be cleared afterwards
    setTimeout(() => setLeaving((list) => list.filter((l) => !gone.includes(l))), EXIT_MS);
  }, [tickets, events]);

  return leaving;
}

/** How many wrong dishes the snapshots have reported so far, counting each event once. */
function useWrongCount(events: readonly OrderEvent[]): number {
  const seen = useRef(new WeakSet<OrderEvent>());
  const [count, setCount] = useState(0);

  useEffect(() => {
    let fresh = 0;

    for (const event of events) {
      if (seen.current.has(event)) continue;
      seen.current.add(event);

      if (event.type === "wrong") fresh += 1;
    }

    if (fresh > 0) setCount((n) => n + fresh);
  }, [events]);

  return count;
}

/** The live ticket rail, fed from the HUD snapshot. */
export function OrderRail() {
  const orders = useAtomValue(ordersAtom);
  const tickets = Option.match(orders, { onNone: () => [], onSome: (o) => o.tickets });
  const events = Option.match(orders, { onNone: () => [], onSome: (o) => o.events });

  return <OrderTickets tickets={tickets} leaving={useLeavingTickets(tickets, events)} wrong={useWrongCount(events)} />;
}
