import { ICONS, LABEL } from "../../kitchen/public.ts";
import type { Base, Filling } from "../../kitchen/public.ts";
import { STEP, STEP_LOOK } from "../prototypes.ts";
import type { TicketView } from "../snapshot.ts";

/** How a ticket left the rail: handed over at the pass, or the customer gave up. */
type TicketOutcome = "served" | "expired";

/** A ticket that just left the rail, kept a moment longer so its exit can play. */
export interface LeavingTicket {
  readonly ticket: TicketView;
  /** Where on the rail it sat, so it leaves from its own slot. */
  readonly index: number;
  readonly outcome: TicketOutcome;
  /** Points it earned (with tip) or cost, signed. */
  readonly points: number;
  readonly tip: number;
}

type Mood = "calm" | "hurry" | "panic";

const BAR: Readonly<Record<Mood, string>> = { calm: "#3fbf4f", hurry: "#f5b324", panic: "#e5322d" };

const CARD: Readonly<Record<Mood, string>> = {
  calm: "bg-[#fffaf0]",
  hurry: "bg-[#fffaf0]",
  panic: "bg-[#ffd9d2] animate-[ticket-shake_0.45s_ease-in-out_infinite]",
};

const MOTION: Readonly<Record<TicketOutcome | "enter", string>> = {
  enter: "animate-[ticket-in_480ms_cubic-bezier(0.2,0.9,0.3,1.15)_both]",
  served: "animate-[ticket-fly_750ms_cubic-bezier(0.5,0,0.8,0.4)_forwards]",
  expired: "animate-[ticket-drop_800ms_ease-in_forwards]",
};

/** A wrong dish at the pass: every waiting ticket flashes red and shakes once. */
const WRONG = "animate-[ticket-wrong_560ms_ease-out]";

/** How much hurry a ticket shows: the bar turns yellow at half, red and shaking under a quarter. */
function moodOf(patience: number): Mood {
  if (patience > 0.5) return "calm";

  if (patience > 0.25) return "hurry";

  return "panic";
}

/** The rail with the leaving tickets slotted back in where they sat. */
function railOf(tickets: readonly TicketView[], leaving: readonly LeavingTicket[]) {
  const rail: { readonly ticket: TicketView; readonly leaving: LeavingTicket | undefined }[] = tickets.map((ticket) => ({ ticket, leaving: undefined }));

  for (const gone of [...leaving].sort((a, b) => a.index - b.index)) {
    rail.splice(Math.min(gone.index, rail.length), 0, { ticket: gone.ticket, leaving: gone });
  }

  return rail;
}

/** The small sign under an ingredient for the work it needs: knife, spit, grill, oven, bottle or sprinkle. */
function StepMark({ of, className }: { readonly of: Base | Filling; readonly className: string }) {
  const look = STEP_LOOK[STEP[of]];

  return (
    <span title={look.label} className={`grid place-items-center rounded-full border-[1.5px] border-[#2a1a10]/70 bg-[#fff3c4] leading-none ${className}`}>
      {look.icon}
    </span>
  );
}

function Ticket({ ticket, still }: { readonly ticket: TicketView; readonly still: boolean }) {
  const mood = moodOf(ticket.patience);
  const card = still ? "bg-[#fffaf0]" : CARD[mood];

  return (
    <div className={`overflow-hidden rounded-xl border-[3px] border-[#2a1a10] text-[#2a1a10] shadow-[0_4px_0_#2a1a10,0_8px_16px_rgb(0_0_0/0.45)] ${card}`}>
      <div className="h-3 border-b-2 border-[#2a1a10] bg-[#5b4636]" role="meter" aria-label="Geduld" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ticket.patience * 100)}>
        <div className="h-full transition-[width,background-color] duration-200" style={{ width: `${Math.max(0, ticket.patience) * 100}%`, background: BAR[mood] }} />
      </div>
      <div className="flex flex-col items-center px-1.5 pb-0.5 pt-0.5">
        <span className="relative">
          <span className="text-[2.6rem] leading-none drop-shadow-[0_2px_0_rgb(0_0_0/0.2)]" role="img" aria-label={`${ticket.name}, ${LABEL[ticket.base]} ${STEP_LOOK[STEP[ticket.base]].label}`}>{ticket.icon}</span>
          <StepMark of={ticket.base} className="absolute -bottom-0.5 -right-3 size-5 text-[0.7rem] shadow-[0_2px_0_rgb(0_0_0/0.25)]" />
        </span>
        <span className="truncate text-[0.68rem] font-extrabold uppercase leading-tight tracking-wide">{ticket.name}</span>
      </div>
      <ul className="flex justify-center gap-1 border-t-2 border-[#2a1a10]/20 bg-[#cfe1ec] px-1 pb-1 pt-1.5">
        {ticket.fillings.map((f) => (
          <li key={f} title={LABEL[f]} aria-label={`${LABEL[f]}, ${STEP_LOOK[STEP[f]].label}`} className="flex flex-col items-center">
            <span className="grid size-6 place-items-center rounded-full border-2 border-[#2a1a10]/70 bg-white text-sm leading-none shadow-[0_2px_0_rgb(0_0_0/0.25)]">{ICONS[f]}</span>
            <StepMark of={f} className="-mt-1 size-[1.15rem] text-[0.7rem]" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PointsPop({ leaving }: { readonly leaving: LeavingTicket }) {
  const served = leaving.outcome === "served";

  return (
    <div className="pointer-events-none absolute left-1 top-full z-10 flex origin-top-left animate-[points-pop_1100ms_ease-out_forwards] flex-col items-start whitespace-nowrap" aria-hidden>
      <span className={`hud-stroke text-5xl font-black ${served ? "text-[#ffd84a]" : "text-[#ff5a4a]"}`}>
        {served ? `+${leaving.points}` : `${leaving.points}`}
      </span>
      {leaving.tip > 0 && <span className="hud-stroke -mt-1 ml-1 text-base font-black text-white [-webkit-text-stroke-width:4px]">+{leaving.tip} Trinkgeld</span>}
    </div>
  );
}

/**
 * The ticket rail: one card per waiting customer, its patience draining as a bar; served and lost tickets play out before they go.
 * `wrong` counts the wrong dishes handed over so far; each new one flashes the waiting tickets.
 */
export function OrderTickets({ tickets, leaving = [], wrong = 0 }: { readonly tickets: readonly TicketView[]; readonly leaving?: readonly LeavingTicket[]; readonly wrong?: number }) {
  return (
    <div className="flex items-start gap-3">
      {(tickets.length > 0 || leaving.length > 0) && (
        <ol className="flex items-start gap-2.5" aria-label="Bestellungen">
          {railOf(tickets, leaving).map(({ ticket, leaving: gone }) => (
            <li key={ticket.id} className="relative w-[6.75rem] shrink-0" aria-hidden={gone !== undefined}>
              <div className={MOTION[gone?.outcome ?? "enter"]}>
                <div key={wrong} className={wrong > 0 && gone === undefined ? WRONG : ""}>
                  <Ticket ticket={ticket} still={gone !== undefined} />
                </div>
              </div>
              {gone && <PointsPop leaving={gone} />}
            </li>
          ))}
        </ol>
      )}
      {tickets.length === 0 && (
        <p className="mt-1 rounded-full border-[3px] border-[#2a1a10] bg-[#fffaf0] px-4 py-1.5 text-sm font-extrabold text-[#2a1a10] shadow-[0_4px_0_#2a1a10]">
          Keine Bestellungen – gleich kommt jemand.
        </p>
      )}
    </div>
  );
}
