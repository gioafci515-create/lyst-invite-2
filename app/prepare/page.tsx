import { redirect } from "next/navigation";

// "Prepare" = schedule, map, dress code and guest info, which live on the event hub.
export default function PreparePage() {
  redirect("/hub");
}
