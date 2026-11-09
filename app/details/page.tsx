import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import RespondScreen from "@/components/screens/RespondScreen";

export const metadata: Metadata = { title: "Your details — UN/FOLD 2026" };

export default function DetailsPage() {
  return (
    <FeatureRoute title="Your details" framed={false}>
      <div id="details">
        <RespondScreen />
      </div>
    </FeatureRoute>
  );
}
