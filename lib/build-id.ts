/**
 * Which build you are looking at.
 *
 * The prototype goes out to reviewers who send back long documents of comments,
 * and a comment is only actionable if we know which build it describes. Vercel
 * stamps every deploy with its own id, so that id is the one string a reader can
 * quote back and we can look up afterwards.
 *
 * It is shown whole rather than shortened. A truncated id reads tidier and is
 * useless in a bug report, because the reader copies what they can see.
 *
 * The environment is read at call time, not at module load. Every page here is
 * force-dynamic, and a value frozen at import would outlive a redeploy on a
 * warm instance and start naming the wrong build.
 */

/** Where this build is running. `local` means nobody deployed it. */
export type BuildWhere = "production" | "preview" | "local";

export interface BuildStampValue {
  /** The deploy's id, or a plain word when there is no deploy. */
  id: string;
  where: BuildWhere;
}

const LOCAL: BuildStampValue = { id: "local", where: "local" };

/**
 * Read the stamp out of an environment.
 *
 * Takes the environment as an argument so a test can hand it one. A deploy that
 * somehow has no id falls back to `local` rather than showing an empty label:
 * saying nothing is better than showing a build called "".
 */
export function readBuildStamp(env: Record<string, string | undefined>): BuildStampValue {
  const id = env.VERCEL_DEPLOYMENT_ID?.trim();
  if (!id) return LOCAL;
  return { id, where: env.VERCEL_ENV === "production" ? "production" : "preview" };
}

export function buildStamp(): BuildStampValue {
  return readBuildStamp(process.env);
}
