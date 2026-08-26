"use client";

import { hierarchy, tree } from "d3-hierarchy";
import { motion } from "motion/react";
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
  const layout = tree<VisualNode>().size([270, 620])(root);

  return (
    <div className="multiverse-canvas" aria-label="Computed future state graph">
      <svg viewBox="0 0 920 410" role="img" aria-labelledby="multiverse-title multiverse-description">
        <title id="multiverse-title">Explored human-agent futures</title>
        <desc id="multiverse-description">Equivalent schedules merge. Counterexample paths are red and safe paths are neutral.</desc>
        <g transform="translate(66,38)">
          {layout.links().map((link, index) => {
            const danger = !link.target.data.safe;
            const path = `M ${link.source.y} ${link.source.x} C ${(link.source.y + link.target.y) / 2} ${link.source.x}, ${(link.source.y + link.target.y) / 2} ${link.target.x}, ${link.target.y} ${link.target.x}`;
            return <motion.path key={`${link.target.data.id}-${index}`} d={path} className={danger ? "branch-danger" : "branch-safe"} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, delay: index * 0.04 }} />;
          })}
          {layout.descendants().map((node) => (
            <g key={node.data.id} transform={`translate(${node.y},${node.x})`}>
              <circle r={node.depth === 0 ? 9 : 7} className={!node.data.safe ? "node-danger" : node.data.actor === "human" ? "node-human" : node.data.actor === "agent" ? "node-agent" : "node-system"} />
              <text x={13} y={-3} className="node-label">{node.data.label}</text>
              <text x={13} y={12} className="node-detail">{node.data.detail}</text>
            </g>
          ))}
        </g>
      </svg>
      <div className="canvas-legend"><span><i className="legend-agent" />Agent</span><span><i className="legend-human" />Human</span><span><i className="legend-danger" />Invariant violation</span></div>
    </div>
  );
}
