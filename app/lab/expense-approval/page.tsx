import { CapabilityRail } from "@/components/paradox/capability-rail";
import { ExplorationWorkspace } from "@/components/paradox/exploration-workspace";
import { PolicyRail } from "@/components/paradox/policy-rail";
import { TraceStrip } from "@/components/paradox/trace-strip";

export default function ExpenseApprovalLabPage() {
  return (
    <div className="instrument-frame">
      <PolicyRail />
      <ExplorationWorkspace />
      <CapabilityRail />
      <TraceStrip />
    </div>
  );
}
