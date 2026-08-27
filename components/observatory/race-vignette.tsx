"use client";

import { Bot, MousePointer2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function RaceVignette({ phase, preview, reduce }: { phase: number; preview: GoldenPreview; reduce: boolean }) {
  const believed = money.format(preview.believed.amountCents / 100);
  const changed = money.format(preview.changed.amountCents / 100);
  const hasChanged = phase >= 1;
  const approved = phase >= 3;
  const amount = hasChanged ? changed : believed;
  const version = hasChanged ? preview.changed.version : preview.believed.version;

  const chip = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? undefined : { opacity: 0, x: -6, transition: { duration: 0.12 } },
    transition: { duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className={`race-vignette${approved ? " is-violated" : hasChanged ? " has-changed" : ""}`} aria-hidden="true">
      <div className="vignette-chrome"><i /><span>Ledger — expense 481</span><code>live demo</code></div>
      <div className="vignette-body">
        <div className="vignette-row">
          <span>MacBook Pro</span>
          <span className={`vignette-status${approved ? " is-approved" : ""}`}>{approved ? "Approved" : "Pending"}</span>
        </div>
        <div className="vignette-amount">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.strong
              key={amount}
              initial={reduce ? false : { y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { y: -16, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {amount}
            </motion.strong>
          </AnimatePresence>
          <code>v{version}</code>
        </div>
        <div className="vignette-events">
          <AnimatePresence initial={false}>
            <motion.div key="inspect" className="vignette-chip is-agent" {...chip(0)}>
              <Bot aria-hidden="true" /><code>inspect_expense() → review v{preview.believed.version}</code>
            </motion.div>
            {phase >= 1 && (
              <motion.div key="edit" className="vignette-chip is-human" {...chip(0.08)}>
                <MousePointer2 aria-hidden="true" /><code>human edits → {changed} · v{preview.changed.version}</code>
              </motion.div>
            )}
            {phase >= 2 && (
              <motion.div key="approve" className="vignette-chip is-agent" {...chip(0.08)}>
                <Bot aria-hidden="true" /><code>approve_reviewed_expense(v{preview.believed.version})</code>
              </motion.div>
            )}
            {phase >= 3 && (
              <motion.div key="violation" className="vignette-chip is-danger" {...chip(0.16)}>
                <code>approved {changed} — reviewed {believed}</code>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
