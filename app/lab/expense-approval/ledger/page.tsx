import { CapabilityRail } from "@/components/paradox/capability-rail";
import { ExpenseFixture } from "@/components/paradox/expense-fixture";
import { PolicyRail } from "@/components/paradox/policy-rail";
import { TraceStrip } from "@/components/paradox/trace-strip";

export default function LedgerFixturePage() {
  return (
    <div className="instrument-frame">
      <PolicyRail />
      <ExpenseFixture />
      <CapabilityRail />
      <TraceStrip />
    </div>
  );
}
