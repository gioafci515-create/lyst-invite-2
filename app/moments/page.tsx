import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import MomentsScreen from "@/components/screens/MomentsScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Tasks") };

export default function MomentsPage() {
  return (
    <FeatureRoute module="tasks" title="Tasks" framed={false} liveCard={false}>
      <MomentsScreen />
    </FeatureRoute>
  );
}
