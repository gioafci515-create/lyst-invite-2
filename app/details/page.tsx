import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import RespondScreen from "@/components/screens/RespondScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Your details") };

export default function DetailsPage() {
  return (
    <FeatureRoute title="Your details" framed={false}>
      <div id="details">
        <RespondScreen />
      </div>
    </FeatureRoute>
  );
}
