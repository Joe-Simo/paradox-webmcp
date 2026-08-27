"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Braces, GitBranch, Radio, RotateCcw, ScanSearch, ShieldCheck } from "lucide-react";
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
        <Badge tone={supported ? "green" : "gray"}>{!hydrated ? "Connecting" : supported ? "Registry live" : "Client needed"}</Badge>
      </div>
      <p className="rail-plain">The structured tools this page registers for agents right now. The set changes as the workflow advances.</p>
      <p className="sr-only" aria-live="polite">{changeStamp > 0 ? `Tool surface changed: ${capabilities.length} tools registered.` : ""}</p>
      <div className={`registry-signal ${supported ? "is-live" : ""}`}>
        <div className="registry-orbit" aria-hidden="true"><Radio /></div>
        <div><span>Active surface</span><strong>{surfaceName(pathname)}</strong></div>
        <div className="registry-count"><code>{capabilities.length.toString().padStart(2, "0")}</code><span>tools</span></div>
      </div>
      {!supported && (
        <div className="compatibility-note" role="status">
          <Braces className="size-4" aria-hidden="true" />
          <p><strong>WebMCP client not detected.</strong> Open this page in a supported agent browser to invoke registered tools. Local controls replay the same domain services. <Link href="/docs#webmcp-client">Setup details</Link></p>
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
              <code>{name.replaceAll("_", "_​")}</code>
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
