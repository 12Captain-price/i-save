import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/ContentPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <ContentPage
      pageKey="terms"
      eyebrow="Terms"
      lead="The rules of membership, in plain language."
    />
  );
}
