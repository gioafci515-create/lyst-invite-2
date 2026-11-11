import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import GalleryScreen from "@/components/screens/GalleryScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Gallery") };

export default function GalleryPage() {
  return (
    <FeatureRoute module="gallery" title="Gallery" framed={false}>
      <GalleryScreen />
    </FeatureRoute>
  );
}
