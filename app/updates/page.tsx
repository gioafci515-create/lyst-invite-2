import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import NotificationsScreen from "@/components/screens/NotificationsScreen";

export const metadata: Metadata = { title: "Updates — UN/FOLD 2026" };

export default function UpdatesPage() {
  return (
    <FeatureRoute title="Updates" intro="Changes and announcements from the hosts, most important first.">
      <NotificationsScreen />
    </FeatureRoute>
  );
}
