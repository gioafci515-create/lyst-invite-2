import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import GuestbookScreen from "@/components/screens/GuestbookScreen";

export const metadata: Metadata = { title: "Voice guestbook — UN/FOLD 2026" };

export default function VoicePage() {
  return (
    <FeatureRoute liveCard={false} module="voice" capture="voice" title="Voice guestbook" framed={false}>
      <GuestbookScreen />
    </FeatureRoute>
  );
}
