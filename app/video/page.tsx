import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import VideoScreen from "@/components/screens/VideoScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Video message") };

export default function VideoPage() {
  return (
    <FeatureRoute liveCard={false} module="video" capture="video" title="Video message" framed={false}>
      <VideoScreen />
    </FeatureRoute>
  );
}
