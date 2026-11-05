import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Send, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-utils";
import {
  askAssistant,
  type AssistantAudience,
  type ChatMessage,
} from "@/lib/assistant";
import { cn } from "@/lib/utils";

const COPY: Record<
  AssistantAudience,
  { title: string; hello: string; ideas: string[] }
> = {
  home: {
    title: "Ask i-Save",
    hello:
      "Hello! I can answer questions about i-Save: how to join, the savings goals and plans, goal-based saving and fees.",
    ideas: [
      "How do I join?",
      "How does goal-based saving work?",
      "Do you pay interest?",
      "How do I install the app?",
    ],
  },
  member: {
    title: "Member help",
    hello:
      "Hello! I can explain the savings goals, plans, fees and how to reach the office. For your balance or payments, your registration agent or the office can help.",
    ideas: [
      "How do I join a plan?",
      "How does goal-based saving work?",
      "What fees will I pay?",
      "How do I contact the office?",
    ],
  },
  staff: {
    title: "Staff help",
    hello:
      "Hello! I can walk you through the admin screens: agents, traffic, plans, announcements, events, team and pages.",
    ideas: [
      "How do I add a registration agent?",
      "How do I read the Traffic page?",
      "How do I set up the goal-based plan?",
      "How do I publish a plan?",
    ],
  },
};

/** Which guide to use depends on where the person is on the site and who they are. */
function useAudience(): AssistantAudience {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { session, roles } = useAuth();
  if (session && path.startsWith("/staff") && isStaffRole(roles))
    return "staff";
  if (session && (path.startsWith("/account") || path.startsWith("/statement")))
    return "member";
  return "home";
}

export function AssistantWidget() {
  const audience = useAudience();
  const copy = COPY[audience];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A different guide means a different conversation.
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [audience]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim().slice(0, 1000);
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const reply = await askAssistant(audience, next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print:hidden">
      {open && (
        <section
          role="dialog"
          aria-label={copy.title}
          className="chat-pop fixed right-4 bottom-20 z-[60] flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <h2 className="text-sm font-semibold">{copy.title}</h2>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError(null);
                  }}
                  className="min-h-11 rounded-md px-2 py-1 text-xs font-semibold hover:bg-primary-foreground/15 sm:min-h-0"
                >
                  Clear chat
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-primary-foreground/15 sm:h-8 sm:w-8"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </header>

          <div
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
            aria-live="polite"
          >
            <p className="rounded-md bg-muted px-3 py-2">{copy.hello}</p>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {copy.ideas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => void send(idea)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "bubble-in max-w-[90%] rounded-md px-3 py-2 whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {m.content}
              </p>
            ))}
            {busy && (
              <p
                role="status"
                className="bubble-in inline-flex rounded-md bg-muted px-3 py-3 text-muted-foreground"
              >
                <span className="sr-only">Thinking…</span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Type your question"
              aria-label="Your question"
              className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-base md:text-sm"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              aria-label="Send"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-4" />
            </button>
          </form>
          <p className="border-t border-border px-3 py-2 text-[0.7rem] text-muted-foreground">
            Automated help. For anything important, check with the office. Never
            type your password or ID number here.
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed right-4 bottom-4 z-[60] inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <MessageCircle aria-hidden="true" className="size-5" />
        <span className="hidden sm:inline">Ask i-Save</span>
      </button>
    </div>
  );
}
