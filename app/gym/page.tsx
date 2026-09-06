import { redirect } from "next/navigation";

/**
 * `/gym` used to be a level-select page of its own, with its own copy of the
 * site nav. Steve ruled on 2026-09-04 that the four account tabs are the only
 * out-of-game chrome now, and that the profile's ladder strip
 * (components/account/progression/ladder-strip.tsx) IS the level select, so a
 * second page for the same job was the confusing second nav he asked to be
 * rid of. This route stays only so old links and bookmarks still land
 * somewhere: it forwards straight to the ladder on the profile.
 */
export default function GymPage() {
  redirect("/#ladder");
}
