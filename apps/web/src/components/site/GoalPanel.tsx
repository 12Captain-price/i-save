import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Flag,
  GraduationCap,
  Plane,
  Shield,
  X,
  type LucideIcon,
} from "lucide-react";
import { type GoalContent, type GoalKey } from "@/lib/goal-content";
import { useLiveGoal } from "@/lib/goal-content-db";
import "./goal-panel.css";

const ICONS: Record<GoalKey, LucideIcon> = {
  asset: Building2,
  holiday: Plane,
  emergency: Shield,
  retrenchment: Briefcase,
  education: GraduationCap,
};

type Tab = "how" | "record" | "voices";
const TABS: { id: Tab; label: string }[] = [
  { id: "how", label: "How it works" },
  { id: "record", label: "The record" },
  { id: "voices", label: "Members say" },
];

/** "412 members chose Asset savings" becomes { big: "412", rest: "members chose Asset savings" }. */
function splitStat(line: string): { big: string; rest: string } | null {
  const m = /^(\d[\d,.]*%?\+?)\s+(.+)$/.exec(line.trim());
  return m ? { big: m[1]!, rest: m[2]! } : null;
}

function StatList({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="goal-panel-block">
      <h3>{title}</h3>
      <ul className="goal-panel-stats">
        {lines.map((t) => {
          const s = splitStat(t);
          return (
            <li key={t}>
              {s ? (
                <>
                  <strong>{s.big}</strong>
                  <span>{s.rest}</span>
                </>
              ) : (
                <span>{t}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A savings goal opened from the home page: how it works, the record, scheduled targets and member words. */
export function GoalPanel({
  goal: baseGoal,
  onClose,
}: {
  goal: GoalContent | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const goal = useLiveGoal(baseGoal);
  const [tab, setTab] = useState<Tab>("how");

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (baseGoal && !el.open) el.showModal();
    if (!baseGoal && el.open) el.close();
    setTab("how");
  }, [baseGoal]);

  const Icon = goal ? ICONS[goal.key] : null;

  return (
    <dialog
      ref={dialog}
      className="goal-panel"
      data-goal={goal?.key}
      aria-labelledby="goal-panel-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      {goal && Icon && (
        <div className="goal-panel-body">
          <header className="goal-panel-head">
            <span className="goal-panel-chip" aria-hidden="true">
              <Icon size={26} strokeWidth={1.6} />
            </span>
            <div>
              <h2 id="goal-panel-title">{goal.label} savings</h2>
              <p className="goal-panel-lead">{goal.about}</p>
              {!goal.real && (
                <p className="goal-panel-sample">
                  Sample content. Figures and quotes are illustrative.
                </p>
              )}
            </div>
            <button
              type="button"
              className="goal-panel-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="goal-panel-tabs" role="tablist" aria-label="Goal details">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`gp-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`gp-view-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            key={tab}
            className="goal-panel-view"
            role="tabpanel"
            id={`gp-view-${tab}`}
            aria-labelledby={`gp-tab-${tab}`}
          >
            {tab === "how" && (
              <ol className="goal-panel-steps">
                {goal.how.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ol>
            )}

            {tab === "record" && (
              <>
                <div className="goal-panel-columns">
                  <StatList title="Past records" lines={goal.past} />
                  <StatList title="Right now" lines={goal.present} />
                </div>
                {goal.ahead.length > 0 && (
                  <section className="goal-panel-block">
                    <h3>Scheduled targets</h3>
                    <ul className="goal-panel-targets">
                      {goal.ahead.map((t) => (
                        <li key={t}>
                          <Flag size={15} aria-hidden="true" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {tab === "voices" && (
              <div className="goal-panel-quotes">
                {goal.quotes.map((q) => (
                  <figure key={q.text}>
                    <blockquote>{q.text}</blockquote>
                    <figcaption>{q.who}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <p className="goal-panel-note">
            Targets show where we are heading. They are not returns, and no
            returns are promised.
          </p>
          <div className="goal-panel-actions">
            <Link
              to="/plans"
              search={{ goal: goal.key }}
              className="goal-panel-link goal-panel-primary"
              onClick={onClose}
            >
              See {goal.label} plans
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/apply" className="goal-panel-link">
              Apply to join
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
