import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/staff/AdminOnly";
import { ErrorLine, PageHeading } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import { LoadingSkeleton } from "@/components/ui/motion";
import { Photo } from "@/components/site/Photo";
import { checkImageFile } from "@/lib/images";
import { deleteAgent, saveAgent, useAgents, type Agent } from "@/lib/agents";
import { isPlaceholderUrl, normalizeAgentUrl } from "@/lib/agent-utils";

export const Route = createFileRoute("/staff/agents")({
  component: () => (
    <AdminOnly title="Agents">
      <AgentsAdmin />
    </AdminOnly>
  ),
});

function AgentsAdmin() {
  const { data, isPending, isError } = useAgents(true);
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  const { run, error } = useContentAction();
  return (
    <div>
      <PageHeading
        title="Registration agents"
        lead="Each agent shows as a button on the Apply page. The button opens that agent's registration link. Changes show on the website straight away."
      />
      <div className="mt-6">
        <Button onClick={() => setEditing("new")}>Add an agent</Button>
      </div>
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      {editing === "new" && (
        <div className="mt-4">
          <AgentForm initial={null} onDone={() => setEditing(null)} />
        </div>
      )}
      {isPending && <LoadingSkeleton />}
      {isError && <ErrorLine message="The agents could not be loaded." />}
      {data?.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No agents yet. Add one so the Apply page has a button to show.
        </p>
      )}
      <div className="mt-6 grid gap-3">
        {data?.map((a) =>
          editing && editing !== "new" && editing.id === a.id ? (
            <AgentForm key={a.id} initial={a} onDone={() => setEditing(null)} />
          ) : (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4"
            >
              <Photo
                path={a.photo_path}
                alt=""
                fallbackName={a.name}
                className="h-14 w-14 rounded-md border border-border text-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.name}
                  {!a.published && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      · Hidden
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm break-all text-muted-foreground">
                  {a.registration_url}
                </p>
                {a.note && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {a.note}
                  </p>
                )}
                {isPlaceholderUrl(a.registration_url) && (
                  <p className="mt-1 text-sm font-medium text-destructive">
                    Placeholder link. Replace it before members use this page.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(a)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${a.name}? Its button will disappear from the Apply page.`,
                      )
                    )
                      void run(() => deleteAgent(a));
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function AgentForm({
  initial,
  onDone,
}: {
  initial: Agent | null;
  onDone: () => void;
}) {
  const { run, busy, error, setError } = useContentAction();
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.registration_url ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [published, setPublished] = useState(initial?.published ?? true);
  const [urlError, setUrlError] = useState<string | undefined>();
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
    setUrlError(undefined);
    if (!name.trim()) {
      setError("Enter the agent's name.");
      return;
    }
    const link = normalizeAgentUrl(url);
    if (!link.ok) {
      setError(null);
      setUrlError(link.message);
      return;
    }
    const ok = await run(() =>
      saveAgent(
        {
          name: name.trim(),
          registration_url: link.value,
          note: note.trim() || null,
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
          className="h-20 w-20 rounded-md border border-border"
        />
        <div>
          <label
            htmlFor="ag-photo"
            className="mb-1.5 block text-sm font-medium"
          >
            Photo (optional)
          </label>
          <input
            id="ag-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {photo
              ? `Selected: ${photo.name}`
              : "The whole picture is shown, nothing is cropped. Without a photo the card shows the agent's initials."}
          </p>
        </div>
      </div>
      <Field
        id="ag-name"
        label="Agent name"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        id="ag-url"
        label="Registration link"
        type="url"
        inputMode="url"
        value={url}
        error={urlError}
        hint="The page where this agent registers new members. It must start with https://"
        onChange={(e) => setUrl(e.target.value)}
      />
      <Field
        id="ag-note"
        label="Short note (optional)"
        value={note}
        maxLength={200}
        hint="For example the town or branch. Shown under the name."
        onChange={(e) => setNote(e.target.value)}
      />
      <Field
        id="ag-order"
        label="Order on the page"
        type="number"
        value={order}
        hint="Smaller numbers show first."
        onChange={(e) => setOrder(e.target.value)}
      />
      <CheckField id="ag-pub" checked={published} onChange={setPublished}>
        Show on the Apply page
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
