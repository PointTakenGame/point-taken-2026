"use client";

/**
 * One looping instructional clip.
 *
 * Ported from the retired client's OnboardingVideo.vue, including its
 * deliberate pause between loops: the video does not use the native `loop`
 * attribute, it waits LOOP_DELAY_MS after `ended` fires and then restarts by
 * hand. That pause is what makes the motion read as a beat rather than a
 * jump cut, so it is kept rather than "simplified" into `loop`.
 *
 * `key={src}` on the caller side (see onboarding-overlay.tsx) is what resets
 * playback when the source changes, e.g. between the plus and minus cut of
 * step one, so this component does not need to watch its own `src` prop.
 */

import { useEffect, useRef } from "react";

const LOOP_DELAY_MS = 800;

export function OnboardingVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function handleEnded() {
      timeoutId = setTimeout(() => {
        if (!video) return;
        video.currentTime = 0;
        void video.play();
      }, LOOP_DELAY_MS);
    }

    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("ended", handleEnded);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full rounded-lg object-cover"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
