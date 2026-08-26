"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
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
  const pathname = usePathname();
  const hydrated = useParadoxStore((state) => state.hydrated);
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return (
    <div className="product-shell">
      <header className="product-header">
        <Link href="/" className="wordmark" aria-label="Paradox home">Paradox</Link>
        <span className="header-thesis">The correctness lab for the human-agent web</span>
        <nav aria-label="Primary navigation" className="mode-nav">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={() => void resetLabService()} aria-label="Reset lab" disabled={!hydrated}>
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </header>
      {children}
    </div>
  );
}
