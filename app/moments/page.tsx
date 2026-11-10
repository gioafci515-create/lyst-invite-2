import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import MomentsScreen from "@/components/screens/MomentsScreen";

export const metadata: Metadata = { title: "Tasks — UN/FOLD 2026" };

export default function MomentsPage() {
  return (
    <FeatureRoute module="tasks" title="Tasks" framed={false} liveCard={false}>
      <MomentsScreen />
    </FeatureRoute>
  );
}
