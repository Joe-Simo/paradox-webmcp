import { CapabilityRail } from "@/components/paradox/capability-rail";
import { VerificationWorkspace } from "@/components/paradox/verification-workspace";

export const metadata: Metadata = { title: "Verified Repair", alternates: { canonical: "/lab/expense-approval/verified" } };

export default function VerifiedPage() {
  return (
    <div className="instrument-frame finding-frame">
      <VerificationWorkspace />
      <CapabilityRail />
    </div>
  );
}
import type { Metadata } from "next";
