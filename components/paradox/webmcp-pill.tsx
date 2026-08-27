"use client";

import { Radio } from "lucide-react";
import { useParadoxStore } from "@/stores/paradox-store";

export function WebmcpPill() {
  const hydrated = useParadoxStore((state) => state.hydrated);
  const webmcpSupported = useParadoxStore((state) => state.webmcpSupported);
  const capabilities = useParadoxStore((state) => state.capabilities);
  return (
    <span
      className={`header-webmcp ${hydrated && webmcpSupported ? "is-live" : ""}`}
      role="status"
      title="A ChatGPT agent can operate this page through its registered WebMCP tools. The tool set changes as the workflow advances."
    >
      <Radio aria-hidden="true" />
      {webmcpSupported
        ? <><span>Agent tools</span><code>{!hydrated ? "…" : capabilities.length}</code></>
        : <span>{!hydrated ? "connecting" : "No agent connected"}</span>}
    </span>
  );
}
