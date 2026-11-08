import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import GuestbookScreen from "@/components/screens/GuestbookScreen";

export const metadata: Metadata = { title: "Voice guestbook — UN/FOLD 2026" };

export default function VoicePage() {
  return (
    <FeatureRoute module="voice" title="Voice guestbook" intro="Record a short voice memory. Only the hosts will hear it.">
      <GuestbookScreen />
    </FeatureRoute>
  );
}
