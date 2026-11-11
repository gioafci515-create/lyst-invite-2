import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import NotificationsScreen from "@/components/screens/NotificationsScreen";
import { pageTitle } from "@/lib/identity";

export const metadata: Metadata = { title: pageTitle("Updates") };

export default function UpdatesPage() {
  return (
    <FeatureRoute title="Updates" intro="Changes and announcements from the hosts, most important first.">
      <NotificationsScreen />
    </FeatureRoute>
  );
}
