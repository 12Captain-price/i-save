import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { StatusPill } from "@/components/staff/StatusPill";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useMemberSearch, type MemberFilter } from "@/lib/staff";
import { formatDate, staffErrorMessage } from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/")({
  component: MemberSearchPage,
});

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "pending", label: "Waiting for activation" },
  { value: "active", label: "Active" },
];

function MemberSearchPage() {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const members = useMemberSearch(term, filter);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTerm(draft);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Members</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Find a member by name, member number, phone or email. Open a member to
        check their ID and record a payment.
      </p>

      <form
        onSubmit={onSubmit}
        role="search"
        className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <div>
          <label
            htmlFor="member-search"
            className="mb-1.5 block text-sm font-medium"
          >
            Search
          </label>
          <input
            id="member-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Name, ISV-000001, 0771234567 or email"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="member-filter"
            className="mb-1.5 block text-sm font-medium"
          >
            Show
          </label>
          <select
            id="member-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as MemberFilter)}
            className={inputClass}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-8" aria-live="polite">
        {members.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Searching…
          </p>
        )}
        {members.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(members.error)}
          </p>
        )}
        {members.data && members.data.length === 0 && (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            No members found. Check the spelling, or search by member number or
            phone instead.
          </p>
        )}
        {members.data && members.data.length > 0 && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {term.trim() === ""
                ? "Newest members first. Showing up to 25."
                : `Showing up to 25 matches for “${term.trim()}”.`}
            </p>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                    <th scope="col" className="px-4 py-3">
                      Member
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Phone
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      ID sighted
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.data.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/staff/members/$memberId"
                          params={{ memberId: m.id }}
                          className="font-semibold text-primary underline underline-offset-4"
                        >
                          {m.full_name || "(no name)"}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {m.member_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">{m.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-4 py-3">
                        {m.id_sighted_at
                          ? formatDate(m.id_sighted_at)
                          : "Not yet"}
                      </td>
                      <td className="px-4 py-3">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
