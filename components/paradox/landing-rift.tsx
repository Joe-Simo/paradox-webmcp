"use client";

import { Bot, CircleAlert, Diamond, Orbit } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { GoldenPreview } from "@/paradox/explorer/golden-preview";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const reveal = (delay: number, reduceMotion: boolean | null) => ({
  initial: reduceMotion ? false : { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.42, delay: reduceMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function LandingRift({ preview }: { preview: GoldenPreview }) {
  const reduceMotion = useReducedMotion();

  return (
    <figure className="temporal-rift" aria-labelledby="rift-title" aria-describedby="rift-description">
      <figcaption id="rift-title" className="rift-header">
        <span><i aria-hidden="true" /> Computed counterexample</span>
        <code>{preview.scheduleId}</code>
      </figcaption>
      <p id="rift-description" className="sr-only">
        The agent inspects expense 481 at 2,399 dollars and version 7. The human changes it to 23,999 dollars and version 8. The agent approves from the stale review, and the system commits version 8.
      </p>

      <div className="rift-stage">
        <div className="rift-grid" aria-hidden="true" />
        <svg className="rift-paths" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M 156 160 C 250 160, 282 315, 382 315 S 515 160, 618 160 S 748 315, 842 315"
            className="rift-path rift-path-base"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.15, delay: reduceMotion ? 0 : 0.12, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d="M 618 160 C 720 160, 748 315, 842 315"
            className="rift-path rift-path-danger"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : 1.05, ease: "easeOut" }}
          />
        </svg>

        <motion.div className="rift-node rift-node-agent rift-node-inspect" {...reveal(0.08, reduceMotion)}>
          <span className="rift-sequence">A1</span>
          <Bot aria-hidden="true" />
          <small>Agent inspects</small>
          <strong>{money.format(preview.believed.amountCents / 100)}</strong>
          <code>version {preview.believed.version}</code>
        </motion.div>

        <motion.div className="rift-node rift-node-human" {...reveal(0.42, reduceMotion)}>
          <span className="rift-sequence">H1</span>
          <Orbit aria-hidden="true" />
          <small>Human changes</small>
          <strong>{money.format(preview.changed.amountCents / 100)}</strong>
          <code>version {preview.changed.version}</code>
        </motion.div>

        <motion.div className="rift-node rift-node-agent rift-node-approve" {...reveal(0.76, reduceMotion)}>
          <span className="rift-sequence">A2</span>
          <Bot aria-hidden="true" />
          <small>Agent acts from</small>
          <strong>review v{preview.believed.version}</strong>
          <code>stale belief</code>
        </motion.div>

        <motion.div className="rift-node rift-node-system" {...reveal(1.08, reduceMotion)}>
          <span className="rift-sequence">S1</span>
          <Diamond aria-hidden="true" />
          <small>System commits</small>
          <strong>{money.format(preview.committed.amountCents / 100)}</strong>
          <code>approved · v{preview.committed.version}</code>
        </motion.div>

      </div>

      <motion.div className="rift-finding" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 1.36, duration: 0.28 }}>
        <CircleAlert aria-hidden="true" />
        <div><span>Invariant violated</span><strong>{preview.invariantId}</strong></div>
        <code>{preview.counterexamples} / {preview.schedulesExplored} schedules</code>
      </motion.div>
    </figure>
  );
}
