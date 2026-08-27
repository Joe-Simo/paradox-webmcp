"use client";

import { useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { ExplorationResult, RepresentativeBranch, TraceStep } from "@/paradox/explorer/types";

type VisualNode = {
  id: string;
  label: string;
  detail: string;
  safe: boolean;
  actor?: TraceStep["actor"];
  children?: VisualNode[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function displayStep(step: TraceStep) {
  if (step.phase.includes("commit")) return `${step.status === "approved" ? "Approved" : "Changed"} ${money.format(step.amountCents / 100)} · v${step.version}`;
  if (step.operation === "inspect") return `Inspected ${money.format(step.amountCents / 100)} · v${step.version}`;
  if (step.operation === "edit") return `Human state ${money.format(step.amountCents / 100)} · v${step.version}`;
  return `${step.phase} · v${step.version}`;
}

function branchNode(branch: RepresentativeBranch, index: number): VisualNode {
  const meaningful = branch.trace.filter((step) =>
    step.phase === "create review token" || step.phase === "commit amount change" || step.phase === "commit mutation" || step.outcome === "STATE_CHANGED",
  );
  const stepNodes: VisualNode[] = meaningful.map((step) => ({
    id: `${branch.scheduleId}-${step.id}`,
    label: displayStep(step),
    detail: step.stateHash,
    actor: step.actor,
    safe: branch.safe,
  }));
  for (let stepIndex = 0; stepIndex < stepNodes.length - 1; stepIndex += 1) {
    stepNodes[stepIndex].children = [stepNodes[stepIndex + 1]];
  }
  return {
    id: branch.scheduleId,
    label: branch.safe ? `Safe future ${index + 1}` : "Counterexample",
    detail: branch.finalStateHash,
    safe: branch.safe,
    children: stepNodes.length > 0 ? [stepNodes[0]] : undefined,
  };
}

export function MultiverseCanvas({ run }: { run: ExplorationResult }) {
  const reduceMotion = useReducedMotion();
  const [zoom, setZoom] = useState(1);
  const failing = run.representativeBranches.find((branch) => !branch.safe);
  const safe = run.representativeBranches.filter((branch) => branch.safe).slice(0, 2);
  const branches = [...(failing ? [failing] : []), ...safe];
  const rootData: VisualNode = {
    id: "initial",
    label: "$2,399 · v7 · pending",
    detail: "Initial state",
    safe: true,
    children: branches.map(branchNode),
  };
  const root = hierarchy(rootData);
  const layout = tree<VisualNode>().size([250, 760])(root);

  return (
    <figure className="multiverse-field" aria-labelledby="multiverse-title multiverse-description">
      <figcaption className="multiverse-field-header">
        <div><span>Temporal field</span><strong id="multiverse-title">Representative computed schedules</strong></div>
        <div className="field-header-actions">
          <div className="field-run-coordinate"><span>{run.schedulesExplored.toLocaleString()} explored</span><code>{run.id}</code></div>
          <div className="field-controls" aria-label="Multiverse zoom controls">
            <Button type="button" variant="tertiary" size="icon" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}><Minus aria-hidden="true" /></Button>
            <Button type="button" variant="tertiary" size="icon" aria-label="Reset zoom" title="Reset zoom" onClick={() => setZoom(1)}><RotateCcw aria-hidden="true" /></Button>
            <Button type="button" variant="tertiary" size="icon" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom((value) => Math.min(1.4, value + 0.2))}><Plus aria-hidden="true" /></Button>
          </div>
        </div>
      </figcaption>
      <p id="multiverse-description" className="sr-only">Equivalent schedules merge. The shortest counterexample remains fully expanded in red while representative safe schedules remain visible.</p>
      <div className="multiverse-canvas" tabIndex={0} role="group" aria-label="Scrollable semantic schedule visualization">
        <div className="multiverse-plane" style={{ width: `${zoom * 100}%` }}>
        <svg viewBox="0 0 1080 430" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="counterexample-signal" x1="0" x2="1">
              <stop offset="0" stopColor="#ffb1b3" />
              <stop offset="0.55" stopColor="#fc0035" />
              <stop offset="1" stopColor="#d8001b" />
            </linearGradient>
          </defs>
          <g className="field-grid">
            {[64, 254, 444, 634, 824].map((x, index) => <line key={x} x1={x} x2={x} y1="58" y2="382" data-major={index === 0 || index === 4 ? "true" : undefined} />)}
            {[100, 225, 350].map((y) => <line key={y} x1="42" x2="1038" y1={y} y2={y} />)}
          </g>
          <g className="field-axis">
            <text x="64" y="36">t0 · origin</text>
            <text x="254" y="36">schedule</text>
            <text x="444" y="36">inspect</text>
            <text x="634" y="36">mutate</text>
            <text x="824" y="36">commit</text>
          </g>
          <g transform="translate(64,100)">
            {layout.links().map((link, index) => {
              const danger = !link.target.data.safe;
              const path = `M ${link.source.y} ${link.source.x} C ${(link.source.y + link.target.y) / 2} ${link.source.x}, ${(link.source.y + link.target.y) / 2} ${link.target.x}, ${link.target.y} ${link.target.x}`;
              return <motion.path key={`${link.target.data.id}-${index}`} d={path} className={danger ? "branch-danger" : "branch-safe"} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: danger ? 0.58 : 0.42, delay: reduceMotion ? 0 : index * 0.035, ease: [0.65, 0, 0.35, 1] }} />;
            })}
            {layout.descendants().map((node) => {
              const className = !node.data.safe ? "node-danger" : node.data.actor === "human" ? "node-human" : node.data.actor === "agent" ? "node-agent" : "node-system";
              const systemShape = node.data.actor === "system" || (!node.data.actor && node.depth > 0);
              return (
                <motion.g key={node.data.id} transform={`translate(${node.y},${node.x})`} initial={false} animate={{ opacity: 1 }}>
                  {systemShape
                    ? <rect x={node.depth === 1 ? -7 : -6} y={node.depth === 1 ? -7 : -6} width={node.depth === 1 ? 14 : 12} height={node.depth === 1 ? 14 : 12} transform="rotate(45)" className={className} />
                    : <circle r={node.depth === 0 ? 9 : 7} className={className} />}
                  <text x={15} y={-4} className="node-label">{node.data.label}</text>
                  <text x={15} y={12} className="node-detail">{node.data.detail}</text>
                </motion.g>
              );
            })}
          </g>
          <motion.g className="merge-capsule" initial={reduceMotion ? false : { x: 12 }} animate={{ x: 0 }} transition={{ delay: reduceMotion ? 0 : 0.68, duration: 0.32 }}>
            <rect x="872" y="374" width="166" height="32" rx="16" />
            <text x="955" y="394" textAnchor="middle">{run.equivalentBranchesMerged} equivalent branches merged</text>
          </motion.g>
        </svg>
        </div>
      </div>
      <div className="multiverse-field-footer">
        <div className="canvas-legend"><span><i className="legend-agent" aria-hidden="true" />Agent</span><span><i className="legend-human" aria-hidden="true" />Human</span><span><i className="legend-danger" aria-hidden="true" />Invariant violation</span></div>
        <p><strong>{run.representativeBranches.length}</strong> representative paths remain expanded; every count above comes from the deterministic explorer.</p>
      </div>
      <section className="sr-only" aria-label="Structured schedule timeline">
        <h2>Representative schedule timeline</h2>
        {run.representativeBranches.map((branch) => <article key={branch.scheduleId}><h3>{branch.safe ? "Safe schedule" : "Invariant-violating schedule"} {branch.scheduleId}</h3><ol>{branch.trace.map((step) => <li key={step.id}>{step.actor}: {displayStep(step)}. State hash {step.stateHash}. {step.outcome ? `Outcome ${step.outcome}.` : ""}</li>)}</ol></article>)}
      </section>
    </figure>
  );
}
