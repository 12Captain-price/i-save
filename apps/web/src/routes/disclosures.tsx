import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/site/PlaceholderPage";

export const Route = createFileRoute("/disclosures")({
  component: DisclosuresPage,
});

function DisclosuresPage() {
  return (
    <PlaceholderPage
      eyebrow="Disclosures"
      title="Risk and withdrawal disclosure"
    />
  );
}
