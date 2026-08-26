import { CapabilityRail } from "@/components/paradox/capability-rail";
import { FindingFocus } from "@/components/paradox/finding-focus";
import { PolicyRail } from "@/components/paradox/policy-rail";

export const metadata: Metadata = { title: "Counterexample" };

export default async function FindingPage({ params }: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await params;
  return (
    <div className="instrument-frame finding-frame">
      <PolicyRail />
      <FindingFocus findingId={findingId} />
      <CapabilityRail />
    </div>
  );
}
import type { Metadata } from "next";
