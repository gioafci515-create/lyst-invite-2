import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import ForLaterScreen from "@/components/screens/ForLaterScreen";

export const metadata: Metadata = { title: "Leave something for later — UN/FOLD 2026" };

export default function ForLaterPage() {
  return (
    <FeatureRoute module="later" title="Leave something for later" framed={false}>
      <ForLaterScreen />
    </FeatureRoute>
  );
}
