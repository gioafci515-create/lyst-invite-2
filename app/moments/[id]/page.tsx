import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import { MomentScreen } from "@/components/screens/MomentsScreen";

export const metadata: Metadata = { title: "A task — UN/FOLD 2026" };

/** the id is read inside the route's Suspense boundary, like every other request-time value */
async function ById({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MomentScreen id={decodeURIComponent(id).slice(0, 60)} />;
}

/** A table card's QR code lands here: one moment, within the phase rules. */
export default function MomentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <FeatureRoute module="tasks" title="Tasks" framed={false} liveCard={false}>
      <ById params={params} />
    </FeatureRoute>
  );
}
