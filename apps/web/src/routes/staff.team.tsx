import { LoadingSkeleton } from "@/components/ui/motion";
import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SupportContactsAdmin } from "@/components/staff/SupportContactsAdmin";
import { AdminOnly } from "@/components/staff/AdminOnly";
import {
  ErrorLine,
  PageHeading,
  TextAreaField,
} from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Photo } from "@/components/site/Photo";
import { Button } from "@/components/ui/button";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import {
  deleteTeamMember,
  saveTeamMember,
  useTeam,
  type TeamMember,
} from "@/lib/content";
import { checkImageFile } from "@/lib/images";
import { groupByLevel } from "@/lib/team-utils";

export const Route = createFileRoute("/staff/team")({
  component: () => (
    <AdminOnly title="Team">
      <TeamAdmin />
    </AdminOnly>
  ),
});

const LEVELS = [
  "Level 1 (top: directors)",
  "Level 2",
  "Level 3",
  "Level 4",
  "Level 5",
  "Level 6",
];

function TeamAdmin() {
  const { data, isPending, isError } = useTeam(true);
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const { run, error } = useContentAction();
  return (
    <div>
      <PageHeading
        title="Meet the team"
        lead="Add each person with a photo. Level 1 is shown first and largest, then level 2 below it, and so on."
      />
      <div className="mt-6">
        <Button onClick={() => setEditing("new")}>Add a person</Button>
      </div>
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      {editing === "new" && (
        <div className="mt-4">
          <TeamForm initial={null} onDone={() => setEditing(null)} />
        </div>
      )}
      {isPending && <LoadingSkeleton />}
      {isError && <ErrorLine message="The team could not be loaded." />}
      <div className="mt-6 grid gap-8">
        {data &&
          groupByLevel(data).map((tier) => (
            <section key={tier[0].level}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {LEVELS[tier[0].level - 1]}
              </h2>
              <div className="grid gap-3">
                {tier.map((m) =>
                  editing && editing !== "new" && editing.id === m.id ? (
                    <TeamForm
                      key={m.id}
                      initial={m}
                      onDone={() => setEditing(null)}
                    />
                  ) : (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4"
                    >
                      <Photo
                        path={m.photo_path}
                        alt={m.full_name}
                        fallbackName={m.full_name}
                        className="h-16 w-16 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{m.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.role_title}
                          {!m.published && " · Hidden"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(m)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${m.full_name} from the team page?`,
                              )
                            )
                              void run(() => deleteTeamMember(m));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
      </div>
      <SupportContactsAdmin />
    </div>
  );
}

function TeamForm({
  initial,
  onDone,
}: {
  initial: TeamMember | null;
  onDone: () => void;
}) {
  const { run, busy, error, setError } = useContentAction();
  const [name, setName] = useState(initial?.full_name ?? "");
  const [role, setRole] = useState(initial?.role_title ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [level, setLevel] = useState(String(initial?.level ?? 1));
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [published, setPublished] = useState(initial?.published ?? true);
  const [photo, setPhoto] = useState<File | null>(null);

  function pick(file: File | null) {
    if (file) {
      const problem = checkImageFile(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setPhoto(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      setError("Enter a name and a role.");
      return;
    }
    const ok = await run(() =>
      saveTeamMember(
        {
          full_name: name.trim(),
          role_title: role.trim(),
          bio: bio.trim() || null,
          level: Number(level),
          sort_order: Number(order) || 100,
          published,
        },
        { id: initial?.id, photo, oldPhotoPath: initial?.photo_path },
      ),
    );
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border border-primary/40 p-5"
    >
      <div className="flex items-center gap-4">
        <Photo
          path={initial?.photo_path ?? null}
          alt=""
          fallbackName={name}
          className="h-20 w-20 rounded-full"
        />
        <div>
          <label
            htmlFor="tm-photo"
            className="mb-1.5 block text-sm font-medium"
          >
            Photo
          </label>
          <input
            id="tm-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {photo
              ? `Selected: ${photo.name}`
              : "A clear head-and-shoulders picture works best. Large photos are shrunk automatically."}
          </p>
        </div>
      </div>
      <Field
        id="tm-name"
        label="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        id="tm-role"
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      />
      <TextAreaField
        id="tm-bio"
        label="Short bio (optional)"
        rows={3}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="tm-level"
            className="mb-1.5 block text-sm font-medium"
          >
            Level in the hierarchy
          </label>
          <select
            id="tm-level"
            className={inputClass}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {LEVELS.map((l, i) => (
              <option key={l} value={i + 1}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="tm-order"
          label="Order inside the level"
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          hint="Smaller numbers show first (left)."
        />
      </div>
      <CheckField id="tm-pub" checked={published} onChange={setPublished}>
        Show on the website
      </CheckField>
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
