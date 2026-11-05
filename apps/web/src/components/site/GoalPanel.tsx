import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { GOAL_CONTENT_IS_SAMPLE, type GoalContent } from "@/lib/goal-content";
import "./goal-panel.css";

/** A savings goal opened from the home page: purpose, how it works, records and member words. */
export function GoalPanel({
  goal,
  onClose,
}: {
  goal: GoalContent | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (goal && !el.open) el.showModal();
    if (!goal && el.open) el.close();
  }, [goal]);

  return (
    <dialog
      ref={dialog}
      className="goal-panel"
      aria-labelledby="goal-panel-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      {goal && (
        <div className="goal-panel-body">
          <button
            type="button"
            className="goal-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <h2 id="goal-panel-title">{goal.label} savings</h2>
          <p className="goal-panel-lead">{goal.about}</p>
          {GOAL_CONTENT_IS_SAMPLE && (
            <p className="goal-panel-sample">
              Sample content. Figures and quotes below are illustrative.
            </p>
          )}

          <section>
            <h3>How saving towards it works</h3>
            <ol className="goal-panel-steps">
              {goal.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </section>

          <div className="goal-panel-columns">
            <section>
              <h3>Past records</h3>
              <ul>
                {goal.past.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Right now</h3>
              <ul>
                {goal.present.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Scheduled targets</h3>
              <ul>
                {goal.ahead.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <h3>What members say</h3>
            <div className="goal-panel-quotes">
              {goal.quotes.map((q) => (
                <figure key={q.text}>
                  <blockquote>{q.text}</blockquote>
                  <figcaption>{q.who}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <p className="goal-panel-note">
            Targets show where we are heading. They are not returns, and no
            returns are promised.
          </p>
          <div className="goal-panel-actions">
            <Link to="/plans" className="goal-panel-link">
              See the plans
            </Link>
            <Link to="/apply" className="goal-panel-link goal-panel-primary">
              Apply to join
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
