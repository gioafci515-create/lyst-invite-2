"use client";

import PhaseShift from "./PhaseShift";
import Reveal from "./Reveal";
import TaskPopup from "./TaskPopup";

/** What every guest page carries on top of its content: the live phase change, the task pop-up and the scroll reveal. */
export default function NightLayer() {
  return (
    <>
      <Reveal />
      <PhaseShift />
      <TaskPopup />
    </>
  );
}
