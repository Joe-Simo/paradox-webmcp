"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParadoxStore } from "@/stores/paradox-store";
import { resetLabService } from "@/stores/services";

const navigation = [
  { href: "/lab/expense-approval/ledger", label: "Record" },
  { href: "/lab/expense-approval", label: "Explore" },
];

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hydrated = useParadoxStore((state) => state.hydrated);
  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="product-header">
        <Link href="/" className="wordmark" aria-label="Paradox home" translate="no">Paradox</Link>
        <span className="header-thesis">The correctness lab for the human-agent web</span>
        <nav aria-label="Primary navigation" className="mode-nav">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href || (item.label === "Explore" && !pathname.endsWith("/ledger")) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="tertiary" size="sm" onClick={() => void resetLabService()} disabled={!hydrated}>
          <RotateCcw className="size-3.5" aria-hidden="true" /> Reset Lab
        </Button>
      </header>
      {children}
    </div>
  );
}
