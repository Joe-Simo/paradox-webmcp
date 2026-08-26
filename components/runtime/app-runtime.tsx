"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { paradoxStore, useParadoxStore } from "@/stores/paradox-store";
import { hydrateWorkspace } from "@/stores/services";
import { toolsForSurface } from "@/webmcp/registry";
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

    const controller = new AbortController();
    let active = true;
    const refresh = async () => {
      const registered = await context.getTools();
      if (active) paradoxStore.setState({ capabilities: registered.map((tool) => tool.name), webmcpSupported: true, webmcpError: null });
    };
    const onToolChange = () => void refresh();
    context.addEventListener("toolchange", onToolChange);
    void Promise.all(toolsForSurface(surfaceFor(pathname)).map((tool) => context.registerTool(tool, { signal: controller.signal })))
      .then(refresh)
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        paradoxStore.setState({
          capabilities: [],
          webmcpSupported: true,
          webmcpError: error instanceof Error ? error.message : "WebMCP tool registration failed.",
        });
      });

    return () => {
      active = false;
      controller.abort();
      context.removeEventListener("toolchange", onToolChange);
    };
  }, [pathname, hydrated, guardMode, findingId]);

  return <TooltipProvider delayDuration={150} skipDelayDuration={0}>{children}</TooltipProvider>;
}
