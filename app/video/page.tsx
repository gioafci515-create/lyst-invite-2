import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import VideoScreen from "@/components/screens/VideoScreen";

export const metadata: Metadata = { title: "Video message — UN/FOLD 2026" };

export default function VideoPage() {
  return (
    <FeatureRoute module="video" title="Video message" intro="Record or upload a clip of up to 45 seconds. The hosts see it first.">
      <VideoScreen />
    </FeatureRoute>
  );
}
