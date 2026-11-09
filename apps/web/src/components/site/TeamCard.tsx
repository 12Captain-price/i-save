import { useState } from "react";
import { MediaViewer } from "@/components/site/MediaViewer";
import { Photo } from "@/components/site/Photo";
import type { EventMedia, TeamMember } from "@/lib/content";

/**
 * One team member. Tapping the round photo opens it enlarged in the same viewer used for
 * event pictures (with Share, Download and Close). A person without a photo shows their
 * initials and is not tappable.
 */
export function TeamCard({
  member,
  large,
}: {
  member: TeamMember;
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const size = large ? "h-40 w-40" : "h-32 w-32";
  const photo = (
    <Photo
      path={member.photo_path}
      alt={member.full_name}
      fallbackName={member.full_name}
      className={`mx-auto ${size} rounded-full border border-border object-cover`}
    />
  );
  const item: EventMedia | null = member.photo_path
    ? {
        id: member.id,
        path: member.photo_path,
        caption: member.role_title,
        sort_order: 0,
        media_type: "image",
        file_name: null,
      }
    : null;

  return (
    <figure className="zoom-photo w-44 text-center sm:w-48">
      {item ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Enlarge photo of ${member.full_name}`}
          className="mx-auto block cursor-zoom-in rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {photo}
        </button>
      ) : (
        photo
      )}
      <figcaption className="mt-3">
        <p className="font-semibold">{member.full_name}</p>
        <p className="text-sm text-primary">{member.role_title}</p>
        {member.bio && (
          <p className="mt-2 text-xs text-muted-foreground">{member.bio}</p>
        )}
      </figcaption>
      {open && item && (
        <MediaViewer
          items={[item]}
          index={0}
          title={member.full_name}
          shareUrl={() => `${window.location.origin}/team`}
          onIndexChange={() => undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </figure>
  );
}
