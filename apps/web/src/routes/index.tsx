import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">i-Save</h1>
      <p>Scaffold is running.</p>
    </main>
  ),
});
