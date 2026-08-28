"use client";

import { motion, useReducedMotion } from "motion/react";
import { useParadoxStore } from "@/stores/paradox-store";
import { Tooltip } from "@/components/ui/tooltip";

const actorLabel = { agent: "A", human: "H", system: "S" } as const;
const actionLabel = {
  inspect_expense: "Inspect expense",
  edit_expense_amount: "Change amount",
  approve_reviewed_expense: "Approve review",
  apply_version_guard: "Apply guard",
  reset_lab: "Reset lab",
} as const;

const sourceLabel = {
  webmcp: "WebMCP",
  local_control: "Local control",
  system: "System",
} as const;

export function TraceStrip() {
  const reduceMotion = useReducedMotion();
  const events = useParadoxStore((state) => state.session.events);
  const visible = events.filter((event) => event.action !== "apply_version_guard").slice(-5);
  if (visible.length === 0) return null;
  return (
    <section className="trace-strip" aria-labelledby="trace-title">
      <div className="trace-title" id="trace-title">Temporal sequence</div>
      <ol className="trace-events">
        {visible.length === 0 ? (
          <li className="trace-empty">Semantic events will appear here as humans and agents operate the fixture.</li>
        ) : visible.map((event, index) => {
          const token = typeof event.metadata.reviewToken === "string" ? ` · ${event.metadata.reviewToken}` : "";
          const source = typeof event.metadata.invocationSource === "string" && event.metadata.invocationSource in sourceLabel
            ? event.metadata.invocationSource as keyof typeof sourceLabel
            : "system";
          const details = `Invocation: ${sourceLabel[source]}. Reads: ${event.reads.join(", ") || "none"}. Writes: ${event.writes.join(", ") || "none"}.${token} State: ${event.preStateHash} → ${event.postStateHash}.`;
          return (
            <Tooltip key={event.id} content={details}>
              <motion.li initial={reduceMotion ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.18 }} className={`trace-event actor-${event.actor}`} tabIndex={0}>
                <span className="trace-marker">{actorLabel[event.actor]}{index + 1}</span>
                <div>
                  <strong>{actionLabel[event.action]}</strong>
                  <span className={`trace-source source-${source}`}>{sourceLabel[source]}</span>
                  <span className="trace-version">v{event.preVersion ?? "—"} → v{event.postVersion ?? "—"} · t{event.logicalTime}</span>
                  <span className="sr-only">{details}</span>
                </div>
              </motion.li>
            </Tooltip>
          );
        })}
      </ol>
    </section>
  );
}
