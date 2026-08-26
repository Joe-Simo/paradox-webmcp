"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { paradoxStore, useParadoxStore } from "@/stores/paradox-store";
import { hydrateWorkspace } from "@/stores/services";
import { toolsForSurface } from "@/webmcp/registry";
import { activateToolSurface } from "@/sdk";
import "@/webmcp/types";

function surfaceFor(pathname: string) {
  if (pathname.includes("/ledger")) return "ledger" as const;
  if (pathname.includes("/finding/")) return "finding" as const;
  if (pathname.endsWith("/verified")) return "verified" as const;
  return "lab" as const;
}

export function AppRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hydrated = useParadoxStore((state) => state.hydrated);
  const guardMode = useParadoxStore((state) => state.session.ledger.guardMode);
  const findingId = useParadoxStore((state) => state.finding?.id ?? null);

  useEffect(() => {
    void hydrateWorkspace();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const context = document.modelContext;
    if (!context) {
      paradoxStore.setState({ webmcpSupported: false, webmcpError: null, capabilities: [] });
      return;
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
  }, [pathname, hydrated, guardMode, findingId]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <TooltipProvider delayDuration={150} skipDelayDuration={0}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
