import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import Essentials from "@/components/Essentials";

export const metadata: Metadata = { title: "Programme and venue — UN/FOLD 2026" };

export default function ProgrammePage() {
  return (
    <FeatureRoute title="Programme and venue" framed={false}>
      <Essentials standalone />
    </FeatureRoute>
  );
}
