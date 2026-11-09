import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import LaterScreen from "@/components/screens/LaterScreen";

export const metadata: Metadata = { title: "Message for later — UN/FOLD 2026" };

export default function LetterPage() {
  return (
    <FeatureRoute module="later" title="Message for later" framed={false}>
      <LaterScreen />
    </FeatureRoute>
  );
}
