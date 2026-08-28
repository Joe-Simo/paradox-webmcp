"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="not-found" id="main-content"><CircleAlert aria-hidden="true" /><span className="section-label">Runtime boundary</span><h1>This timeline stopped unexpectedly.</h1><p>Paradox preserved the browser state. Retry this surface, or return to the landing and reset the lab from there.</p><Button onClick={reset}><RotateCw aria-hidden="true" /> Retry surface</Button></main>;
}
