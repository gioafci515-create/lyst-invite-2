import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import CapsuleScreen from "@/components/screens/CapsuleScreen";

export const metadata: Metadata = { title: "Time capsule — UN/FOLD 2026" };

export default function CapsulePage() {
  return (
    <FeatureRoute module="capsule" title="Time capsule" intro="Everything shared tonight is sealed into one archive that unlocks later.">
      <CapsuleScreen />
    </FeatureRoute>
  );
}
