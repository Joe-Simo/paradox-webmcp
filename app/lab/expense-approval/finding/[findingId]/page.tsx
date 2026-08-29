import { CapabilityRail } from "@/components/paradox/capability-rail";
import { FindingFocus } from "@/components/paradox/finding-focus";

export const metadata: Metadata = { title: "Counterexample", alternates: { canonical: "/lab/expense-approval" } };

export default async function FindingPage({ params }: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await params;
  return (
    <div className="instrument-frame finding-frame">
      <FindingFocus findingId={findingId} />
      <CapabilityRail />
    </div>
  );
}
import type { Metadata } from "next";
