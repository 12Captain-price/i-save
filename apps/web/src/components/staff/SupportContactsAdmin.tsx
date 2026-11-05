import { useConfirm } from "@/components/ui/confirm";
import { LoadingSkeleton } from "@/components/ui/motion";
import { useState, type FormEvent } from "react";
import { ErrorLine } from "@/components/staff/FormBits";
import { useContentAction } from "@/components/staff/useContentAction";
import { WhatsAppIcon } from "@/components/whatsapp/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { CheckField, Field } from "@/components/ui/field";
import { normalizePhone } from "@/lib/phone";
import {
  deleteSupportContact,
  saveSupportContact,
  useSupportContacts,
  type SupportContact,
} from "@/lib/support-contacts";

/** Admin: the staff who appear under "Ask for assistance" on the member side. */
export function SupportContactsAdmin() {
  const { data, isPending, isError } = useSupportContacts();
  const [editing, setEditing] = useState<SupportContact | "new" | null>(null);
  const ask = useConfirm();
  const { run, error } = useContentAction();

  return (
    <section
      aria-labelledby="support-heading"
      className="mt-12 border-t border-border pt-8"
    >
      <h2
        id="support-heading"
        className="flex items-center gap-2 text-2xl font-semibold"
      >
        <WhatsAppIcon className="h-6 w-6 text-[#128C7E]" />
        WhatsApp contacts for members
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        These people appear when a member taps “Ask for assistance”. Only
        signed-in members and staff can see these numbers. They are never shown
        on the public Team page. The office WhatsApp number is always listed
        first.
      </p>
      <div className="mt-5">
        <Button onClick={() => setEditing("new")}>Add a contact</Button>
      </div>
      <div className="mt-4">
        <ErrorLine message={error} />
      </div>
      {editing === "new" && (
        <div className="mt-4">
          <ContactForm initial={null} onDone={() => setEditing(null)} />
        </div>
      )}
      {isPending && <LoadingSkeleton />}
      {isError && <ErrorLine message="The contacts could not be loaded." />}
      <div className="mt-4 grid gap-3">
        {data?.map((c) =>
          editing && editing !== "new" && editing.id === c.id ? (
            <ContactForm
              key={c.id}
              initial={c}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.role_title} · {c.whatsapp_phone}
                  {!c.active && " · Hidden from members"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(c)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void ask({
                      title: `Remove ${c.full_name}?`,
                      message:
                        "They will no longer appear in the WhatsApp contacts members can message.",
                      confirmLabel: "Yes, remove",
                      tone: "danger",
                    }).then((ok) => {
                      if (ok) void run(() => deleteSupportContact(c.id));
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ),
        )}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No staff contacts yet. Members can still message the office number.
          </p>
        )}
      </div>
    </section>
  );
}

function ContactForm({
  initial,
  onDone,
}: {
  initial: SupportContact | null;
  onDone: () => void;
}) {
  const { run, busy, error, setError } = useContentAction();
  const [name, setName] = useState(initial?.full_name ?? "");
  const [role, setRole] = useState(initial?.role_title ?? "");
  const [phone, setPhone] = useState(initial?.whatsapp_phone ?? "");
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [active, setActive] = useState(initial?.active ?? true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      setError("Enter a name and a role.");
      return;
    }
    const parsed = normalizePhone(phone);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    const ok = await run(() =>
      saveSupportContact(
        {
          full_name: name.trim(),
          role_title: role.trim(),
          whatsapp_phone: parsed.value,
          sort_order: Number(order) || 100,
          active,
        },
        initial?.id,
      ),
    );
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border border-primary/40 p-5"
    >
      <Field
        id="sc-name"
        label="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        id="sc-role"
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      />
      <Field
        id="sc-phone"
        label="WhatsApp number"
        hint="For example 0771234567. It is saved as +263771234567."
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Field
        id="sc-order"
        label="Order in the list"
        type="number"
        hint="Smaller numbers come first."
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      />
      <CheckField id="sc-active" checked={active} onChange={setActive}>
        Show to members
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
