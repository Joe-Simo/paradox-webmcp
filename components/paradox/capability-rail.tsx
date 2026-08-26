"use client";

import { Braces, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useParadoxStore } from "@/stores/paradox-store";

const descriptions: Record<string, string> = {
  inspect_expense: "Read state and bind a review.",
  approve_reviewed_expense: "Complete the active review.",
  inspect_lab: "Read the current model.",
  explore_futures: "Search valid interleavings.",
  inspect_counterexample: "Explain the shortest failure.",
  apply_version_guard: "Install the constrained guard.",
  verify_repair: "Replay and re-explore.",
  reset_lab: "Restore the initial state.",
};

export function CapabilityRail() {
  const capabilities = useParadoxStore((state) => state.capabilities);
  const supported = useParadoxStore((state) => state.webmcpSupported);
  const registryError = useParadoxStore((state) => state.webmcpError);
  return (
    <aside className="capability-rail" aria-label="Available WebMCP capabilities">
      <div className="rail-heading">
        <span>WebMCP capabilities</span>
        <Badge tone={supported ? "green" : "gray"}>{supported ? "Available" : "Unavailable"}</Badge>
      </div>
      {!supported && (
        <div className="compatibility-note" role="status">
          <Braces className="size-4" aria-hidden="true" />
          <p>WebMCP is unavailable in this browser. Human controls remain active.</p>
        </div>
      )}
      {registryError && (
        <div className="compatibility-note" role="alert">
          <Braces className="size-4" aria-hidden="true" />
          <p>Registry error: {registryError}</p>
        </div>
      )}
      <div className="capability-list">
        {capabilities.map((name, index) => (
          <div className="capability-row" key={name}>
            <div className="capability-icon" aria-hidden="true">{index % 2 === 0 ? <Sparkles /> : <ShieldCheck />}</div>
            <div>
              <code>{name}</code>
              <p>{descriptions[name] ?? "Active structured capability."}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
