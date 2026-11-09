import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import VideoScreen from "@/components/screens/VideoScreen";

export const metadata: Metadata = { title: "Video message — UN/FOLD 2026" };

export default function VideoPage() {
  return (
    <FeatureRoute module="video" capture="video" title="Video message" framed={false}>
      <VideoScreen />
    </FeatureRoute>
  );
}
