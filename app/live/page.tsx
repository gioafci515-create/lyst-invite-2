import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import InteractScreen from "@/components/screens/InteractScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Live room") };

export default function LivePage() {
  return (
    <FeatureRoute module="live" capture="live" title="Live room" framed={false}>
      <InteractScreen />
    </FeatureRoute>
  );
}
