import { CapabilityRail } from "@/components/paradox/capability-rail";
import { ExpenseFixture } from "@/components/paradox/expense-fixture";
import { TraceStrip } from "@/components/paradox/trace-strip";

export const metadata: Metadata = { title: "Ledger Race", alternates: { canonical: "/lab/expense-approval/ledger" } };

export default function LedgerFixturePage() {
  return (
    <div className="instrument-frame">
      <ExpenseFixture />
      <CapabilityRail />
      <TraceStrip />
    </div>
  );
}
import type { Metadata } from "next";
