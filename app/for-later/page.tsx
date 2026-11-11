import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import ForLaterScreen from "@/components/screens/ForLaterScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Leave something for later") };

export default function ForLaterPage() {
  return (
    <FeatureRoute liveCard={false} module="later" title="Leave something for later" framed={false}>
      <ForLaterScreen />
    </FeatureRoute>
  );
}
