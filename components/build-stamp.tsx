import { buildStamp } from "@/lib/build-id";

/**
 * The footer that names this build.
 *
 * While the prototype is under review this is load-bearing rather than
 * decorative: reviewers send back long documents of comments, and a comment
 * about a screen that has since changed is worse than no comment. The id is
 * selectable text so it can be pasted, and it asks to be quoted, because a
 * reader who does not know it is wanted will not think to include it.
 */
export function BuildStamp() {
  const { id, where } = buildStamp();

  if (where === "local") {
    return (
      <p className="text-xs opacity-40">Running locally, so this build has no id.</p>
    );
  }

  return (
    <p className="text-xs opacity-40">
      {where === "preview" ? "Preview build " : "Build "}
      <code className="font-mono select-all">{id}</code>. Quote it if you report
      something.
    </p>
  );
}
