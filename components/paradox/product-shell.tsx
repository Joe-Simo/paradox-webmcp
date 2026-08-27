"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WebmcpPill } from "@/components/paradox/webmcp-pill";
import { useParadoxStore } from "@/stores/paradox-store";
import { resetLabService } from "@/stores/services";
import { hasRecordedRace } from "@/domain/ledger/model";

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hydrated = useParadoxStore((state) => state.hydrated);
  const session = useParadoxStore((state) => state.session);
  const finding = useParadoxStore((state) => state.finding);
  const verification = useParadoxStore((state) => state.verification);
  const guarded = session.ledger.guardMode === "versioned";

  const acts = [
    {
      index: 1,
      label: "Record",
      href: "/lab/expense-approval/ledger",
      available: true,
      done: hasRecordedRace(session),
      current: pathname.endsWith("/ledger"),
      hint: "Operate the instrumented expense fixture.",
    },
    {
      index: 2,
      label: "Explore",
      href: "/lab/expense-approval",
      available: true,
      done: Boolean(finding),
      current: pathname === "/lab/expense-approval",
      hint: "Search every ordering of the recorded operations.",
    },
    {
      index: 3,
      label: "Repair",
      href: finding ? `/lab/expense-approval/finding/${finding.id}` : null,
      available: Boolean(finding),
      done: guarded,
      current: pathname.includes("/finding/"),
      hint: finding ? "Focus the shortest counterexample." : "Available after exploration finds a counterexample.",
    },
    {
      index: 4,
      label: "Verify",
      href: finding && guarded ? "/lab/expense-approval/verified" : null,
      available: Boolean(finding && guarded),
      done: Boolean(verification?.verified),
      current: pathname.endsWith("/verified"),
      hint: finding && guarded ? "Replay the race against the guard." : "Available after the version guard is applied.",
    },
  ];

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="product-header">
        <Link href="/" className="wordmark" aria-label="Paradox home" translate="no">Paradox</Link>
        <span className="header-spacer" aria-hidden="true" />
        <WebmcpPill />
        <nav aria-label="Lab acts" className="mode-nav">
          {acts.map((act) =>
            act.available && act.href ? (
              <Link
                key={act.label}
                href={act.href}
                aria-current={act.current ? "page" : undefined}
                aria-label={act.label}
                className={act.done ? "act-done" : undefined}
                title={act.hint}
              >
                <i aria-hidden="true">{act.done && !act.current ? <Check /> : act.index}</i>
                <span>{act.label}</span>
              </Link>
            ) : (
              <span key={act.label} className="act-locked" aria-disabled="true" title={act.hint}>
                <i aria-hidden="true">{act.index}</i>
                <span>{act.label}</span>
                <span className="sr-only">{act.hint}</span>
              </span>
            ),
          )}
        </nav>
        <Button aria-label="Reset Lab" variant="tertiary" size="sm" onClick={() => void resetLabService()} disabled={!hydrated}>
          <RotateCcw className="size-3.5" aria-hidden="true" /> <span>Reset<span className="reset-label-suffix"> Lab</span></span>
        </Button>
      </header>
      {children}
    </div>
  );
}
