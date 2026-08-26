"use client";

import { motion } from "motion/react";
import { useParadoxStore } from "@/stores/paradox-store";

const actorLabel = { agent: "A", human: "H", system: "S" } as const;
const actionLabel = {
  inspect_expense: "Inspect expense",
  edit_expense_amount: "Change amount",
  approve_reviewed_expense: "Approve review",
  apply_version_guard: "Apply guard",
  reset_lab: "Reset lab",
} as const;

export function TraceStrip() {
  const events = useParadoxStore((state) => state.session.events);
  const visible = events.filter((event) => event.action !== "apply_version_guard").slice(-5);
  return (
    <section className="trace-strip" aria-labelledby="trace-title">
      <div className="trace-title" id="trace-title">Temporal sequence</div>
      <ol className="trace-events">
        {visible.length === 0 ? (
          <li className="trace-empty">Semantic events will appear here as humans and agents operate the fixture.</li>
        ) : visible.map((event, index) => (
          <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={event.id} className={`trace-event actor-${event.actor}`}>
            <span className="trace-marker">{actorLabel[event.actor]}{index + 1}</span>
            <div>
              <strong>{actionLabel[event.action]}</strong>
              <code>{event.preStateHash} → {event.postStateHash}</code>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
