import SiteHeader from "@/components/SiteHeader";
import Stage from "@/components/Stage";
import InviteScreen from "@/components/screens/InviteScreen";
import HubScreen from "@/components/screens/HubScreen";
import RespondScreen from "@/components/screens/RespondScreen";
import CameraScreen from "@/components/screens/CameraScreen";
import GuestbookScreen from "@/components/screens/GuestbookScreen";
import VideoScreen from "@/components/screens/VideoScreen";
import LaterScreen from "@/components/screens/LaterScreen";
import InteractScreen from "@/components/screens/InteractScreen";
import GalleryScreen from "@/components/screens/GalleryScreen";
import CapsuleScreen from "@/components/screens/CapsuleScreen";
import NotificationsScreen from "@/components/screens/NotificationsScreen";
import { EmbedProvider, SECTION } from "@/components/Embed";
import styles from "@/components/site.module.css";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Invite: hero, story carousel, programme and the quick RSVP */}
        <EmbedProvider>
          <InviteScreen />
        </EmbedProvider>

        <Stage
          id={SECTION.hub}
          eyebrow="Prepare"
          title="Event hub"
          lead="Everything for the night in one place: the live announcement, schedule, map, dress code and guest information."
          tone="cream"
          wide
        >
          <HubScreen />
        </Stage>

        <Stage
          id={SECTION.details}
          eyebrow="Respond"
          title="Your details"
          lead="Add your plus-one, meal choice, dietary needs and access requests. You can update them any time before the deadline."
        >
          <RespondScreen />
        </Stage>

        <Stage
          id={SECTION.camera}
          eyebrow="Participate"
          title="Disposable camera"
          lead="Capture moments during the night. Photos go to a locked roll that opens after the event."
          tone="cream"
        >
          <CameraScreen />
        </Stage>

        <Stage
          id={SECTION.voice}
          eyebrow="Participate"
          title="Voice guestbook"
          lead="Record a short voice memory for the hosts. Pause, re-record and send when you're happy with it."
        >
          <GuestbookScreen />
        </Stage>

        <Stage
          id={SECTION.video}
          eyebrow="Participate"
          title="Video messages"
          lead="Record or upload a clip of up to one minute. Clips are cut into the one-year film."
          tone="cream"
        >
          <VideoScreen />
        </Stage>

        <Stage
          id={SECTION.later}
          eyebrow="Remember"
          title="Message for later"
          lead="Write a note to be sealed and revealed on a future date, with a photo if you like."
        >
          <LaterScreen />
        </Stage>

        <Stage
          id={SECTION.live}
          eyebrow="Participate"
          title="Live room"
          lead="Letters, the photo challenge, the live poll and questions for the hosts, all updated as the night unfolds."
          tone="cream"
        >
          <InteractScreen />
        </Stage>

        <Stage
          id={SECTION.gallery}
          eyebrow="Remember"
          title="Guest gallery"
          lead="Browse approved photos and videos from the night, or add your own for the hosts to approve."
        >
          <GalleryScreen />
        </Stage>

        <Stage
          id={SECTION.capsule}
          eyebrow="Remember"
          title="Time capsule"
          lead="Everything shared tonight is sealed into one archive that unlocks a year from now."
          tone="cream"
        >
          <CapsuleScreen />
        </Stage>

        <Stage
          id={SECTION.updates}
          eyebrow="Prepare"
          title="Notifications"
          lead="Priority updates and changes from the hosts, newest and most important first."
        >
          <NotificationsScreen />
        </Stage>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerMark}>LYST / invitations</p>
        <div className={styles.footerRight}>
          <p>Host contact · hello@lyst.events · Privacy · Accessibility</p>
          <p>Invitation access is limited to named guests.</p>
        </div>
      </footer>
    </>
  );
}
