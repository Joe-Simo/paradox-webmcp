import { CapabilityRail } from "@/components/paradox/capability-rail";
import { FindingFocus } from "@/components/paradox/finding-focus";
import { PolicyRail } from "@/components/paradox/policy-rail";

export default function FindingPage() {
  return (
    <div className="instrument-frame finding-frame">
      <PolicyRail />
      <FindingFocus />
      <CapabilityRail />
    </div>
  );
}
