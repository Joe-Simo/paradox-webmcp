"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { paradoxStore, useParadoxStore } from "@/stores/paradox-store";
import { hydrateWorkspace } from "@/stores/services";
import { toolsForSurface } from "@/webmcp/registry";
import { activateToolSurface } from "@/sdk";
import "@/webmcp/types";

function surfaceFor(pathname: string) {
  if (pathname === "/" || pathname.includes("/ledger")) return "ledger" as const;
  if (pathname.includes("/finding/")) return "finding" as const;
  if (pathname.endsWith("/verified")) return "verified" as const;
  return "lab" as const;
}

function resolveModelContext() {
  return document.modelContext ?? navigator.modelContext;
}

export function AppRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [contextTick, setContextTick] = useState(0);
  const hydrated = useParadoxStore((state) => state.hydrated);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);
  const findingId = useParadoxStore((state) => state.finding?.id ?? null);

  useEffect(() => {
    void hydrateWorkspace();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const context = resolveModelContext();
    if (!context) {
      paradoxStore.setState({ webmcpSupported: false, webmcpError: null, capabilities: [] });
      // A WebMCP host can appear after load (e.g. the user enables site tools
      // in the agent browser while the page is open) — keep watching for it.
      const poll = window.setInterval(() => {
        if (resolveModelContext()) {
          window.clearInterval(poll);
          setContextTick((tick) => tick + 1);
        }
      }, 1000);
      return () => window.clearInterval(poll);
    }

    return activateToolSurface({
      context,
      tools: toolsForSurface(surfaceFor(pathname)),
      onToolsChanged: (registered) => paradoxStore.setState({ capabilities: registered.map((tool) => tool.name), webmcpSupported: true, webmcpError: null }),
      onError: (error) => {
        paradoxStore.setState({
          capabilities: [],
          webmcpSupported: true,
          webmcpError: error instanceof Error ? error.message : "WebMCP tool registration failed.",
        });
      },
    });
  }, [pathname, hydrated, guardMode, findingId, contextTick]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <TooltipProvider delayDuration={150} skipDelayDuration={0}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
