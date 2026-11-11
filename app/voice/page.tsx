import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import GuestbookScreen from "@/components/screens/GuestbookScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Voice guestbook") };

export default function VoicePage() {
  return (
    <FeatureRoute liveCard={false} module="voice" capture="voice" title="Voice guestbook" framed={false}>
      <GuestbookScreen />
    </FeatureRoute>
  );
}
