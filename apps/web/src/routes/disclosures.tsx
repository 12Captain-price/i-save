import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/disclosures")({
  component: DisclosuresPage,
});

function DisclosuresPage() {
  return (
    <ContentPage
      pageKey="disclosures"
      eyebrow="Disclosures"
      lead="Important things to know before you save."
    />
  );
}
