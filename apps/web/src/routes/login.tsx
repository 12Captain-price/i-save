import { useState, type FormEvent } from "react";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { friendlyLoginError } from "@/lib/auth-errors";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { markWelcomePending } from "@/lib/welcome";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/account" />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(friendlyLoginError(signInError.message));
      return;
    }
    markWelcomePending();
    await navigate({ to: "/account" });
  }

  return (
    <AuthCard
      title="Log in"
      lead="Use the email and password you applied with."
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <a
            href="/forgot-password"
            className="text-primary underline underline-offset-4"
          >
            Forgot your password?
          </a>
          <a
            href="/apply"
            className="text-primary underline underline-offset-4"
          >
            Apply for membership
          </a>
        </div>
      </form>
    </AuthCard>
  );
}
