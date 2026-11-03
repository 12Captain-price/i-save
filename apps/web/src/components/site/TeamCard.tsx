import { Photo } from "@/components/site/Photo";
import type { TeamMember } from "@/lib/content";

export function TeamCard({
  member,
  large,
}: {
  member: TeamMember;
  large?: boolean;
}) {
  return (
    <figure className="zoom-photo w-44 text-center sm:w-48">
      <Photo
        path={member.photo_path}
        alt={member.full_name}
        fallbackName={member.full_name}
        className={
          large
            ? "mx-auto h-40 w-40 rounded-full border border-border"
            : "mx-auto h-32 w-32 rounded-full border border-border"
        }
      />
      <figcaption className="mt-3">
        <p className="font-semibold">{member.full_name}</p>
        <p className="text-sm text-primary">{member.role_title}</p>
        {member.bio && (
          <p className="mt-2 text-xs text-muted-foreground">{member.bio}</p>
        )}
      </figcaption>
    </figure>
  );
}
