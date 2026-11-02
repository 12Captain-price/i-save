import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <ContentPage
      pageKey="privacy"
      eyebrow="Privacy"
      lead="What we collect, why, and who can see it."
    />
  );
}
