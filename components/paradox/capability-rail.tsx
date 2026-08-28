"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Braces, GitBranch, RotateCcw, ScanSearch, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const icons: Record<string, LucideIcon> = {
  inspect_expense: ScanSearch,
  approve_reviewed_expense: ShieldCheck,
  inspect_lab: ScanSearch,
  explore_futures: GitBranch,
  inspect_counterexample: ScanSearch,
  apply_version_guard: ShieldCheck,
  verify_repair: ShieldCheck,
  reset_lab: RotateCcw,
};

function surfaceName(pathname: string) {
  if (pathname.includes("/ledger")) return "Ledger";
  if (pathname.includes("/finding/")) return "Finding";
  if (pathname.endsWith("/verified")) return "Verified";
  return "Explorer";
}

export function CapabilityRail() {
  const pathname = usePathname() ?? "/";
  const hydrated = useParadoxStore((state) => state.hydrated);
  const capabilities = useParadoxStore((state) => state.capabilities);
  const supported = useParadoxStore((state) => state.webmcpSupported);
  const registryError = useParadoxStore((state) => state.webmcpError);
  const [changeStamp, setChangeStamp] = useState(0);
  const previousTools = useRef<string>("");

  useEffect(() => {
    const signature = capabilities.join("|");
    if (previousTools.current && signature && signature !== previousTools.current) {
      setChangeStamp((stamp) => stamp + 1);
    }
    previousTools.current = signature;
  }, [capabilities]);

  return (
    <aside className="capability-rail" aria-label="Available WebMCP capabilities">
      <div className="rail-heading">
        <span>WebMCP capabilities</span>
        <Badge tone={supported ? "green" : "gray"}>{!hydrated ? "Connecting" : supported ? `Live · ${surfaceName(pathname)}` : "No agent"}</Badge>
      </div>
      <p className="sr-only" aria-live="polite">{changeStamp > 0 ? `Tool surface changed: ${capabilities.length} tools registered.` : ""}</p>
      {!supported && (
        <div className="compatibility-note" role="status">
          <Braces className="size-4" aria-hidden="true" />
          <p>No agent connected — these tools wait for a WebMCP browser. The buttons work everywhere. <Link href="/docs#webmcp-client">Setup</Link></p>
        </div>
      )}
      {registryError && (
        <div className="compatibility-note" role="alert">
          <Braces className="size-4" aria-hidden="true" />
          <p>Registry error: {registryError}</p>
        </div>
      )}
      <div className="capability-list" key={changeStamp} data-changed={changeStamp > 0 || undefined}>
        {capabilities.map((name) => {
          const Icon = icons[name] ?? Braces;
          return (
          <div className="capability-row" key={name}>
            <div className="capability-icon" aria-hidden="true"><Icon /></div>
            <div>
              <code>{name}</code>
              <p>{descriptions[name] ?? "Active structured capability."}</p>
            </div>
            <span className="capability-live" aria-label="Registered">live</span>
          </div>
          );
        })}
      </div>
    </aside>
  );
}
