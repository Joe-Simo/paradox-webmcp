import { CapabilityRail } from "@/components/paradox/capability-rail";
import { ExplorationWorkspace } from "@/components/paradox/exploration-workspace";
import { TraceStrip } from "@/components/paradox/trace-strip";

export const metadata: Metadata = { title: "Explore Futures", alternates: { canonical: "/lab/expense-approval" } };

export default function ExpenseApprovalLabPage() {
  return (
    <div className="instrument-frame">
      <ExplorationWorkspace />
      <CapabilityRail />
      <TraceStrip />
    </div>
  );
}
import type { Metadata } from "next";
