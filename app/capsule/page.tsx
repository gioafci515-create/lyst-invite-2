import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import CapsuleScreen from "@/components/screens/CapsuleScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Time capsule") };

export default function CapsulePage() {
  return (
    <FeatureRoute liveCard={false} module="capsule" title="Time capsule" framed={false}>
      <CapsuleScreen />
    </FeatureRoute>
  );
}
