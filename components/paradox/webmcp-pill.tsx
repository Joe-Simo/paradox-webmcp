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
      <span>{webmcpSupported ? "WebMCP client" : "local controls"}</span>
      <code>{!hydrated ? "connecting" : webmcpSupported ? `${capabilities.length} tools` : "no registry"}</code>
    </span>
  );
}
