import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import GalleryScreen from "@/components/screens/GalleryScreen";

export const metadata: Metadata = { title: "Gallery — UN/FOLD 2026" };

export default function GalleryPage() {
  return (
    <FeatureRoute module="gallery" title="Gallery" intro="Photos and clips from the night appear here once the hosts approve them.">
      <GalleryScreen />
    </FeatureRoute>
  );
}
