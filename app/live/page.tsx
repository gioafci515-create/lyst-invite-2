import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import InteractScreen from "@/components/screens/InteractScreen";

export const metadata: Metadata = { title: "Live room — UN/FOLD 2026" };

export default function LivePage() {
  return (
    <FeatureRoute module="live" title="Live room" intro="Letters, the photo challenge, the live poll and questions for the hosts.">
      <InteractScreen />
    </FeatureRoute>
  );
}
