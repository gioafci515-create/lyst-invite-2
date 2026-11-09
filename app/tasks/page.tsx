import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import TasksScreen from "@/components/screens/TasksScreen";

export const metadata: Metadata = { title: "Tasks — UN/FOLD 2026" };

export default function TasksPage() {
  return (
    <FeatureRoute module="tasks" capture="tasks" title="Tasks" intro="Short tasks unlock through the night. Turn on reminders and your phone buzzes when the next one opens.">
      <TasksScreen />
    </FeatureRoute>
  );
}
