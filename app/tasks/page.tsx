import type { Metadata } from "next";
import FeatureRoute from "@/components/FeatureRoute";
import TasksScreen from "@/components/screens/TasksScreen";

export const metadata: Metadata = { title: "Tonight's tasks — UN/FOLD 2026" };

export default function TasksPage() {
  return (
    <FeatureRoute module="tasks" title="Tonight's tasks" intro="Short tasks unlock through the night. Turn on reminders and your phone buzzes when the next one opens.">
      <TasksScreen />
    </FeatureRoute>
  );
}
