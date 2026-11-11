import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import Essentials from "@/components/Essentials";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Programme and venue") };

export default function ProgrammePage() {
  return (
    <FeatureRoute title="Programme and venue" framed={false}>
      <Essentials standalone />
    </FeatureRoute>
  );
}
