import { boss, CERTIFICATES } from "@/lib/progression/sample";
import { coachCard } from "@/lib/coach/cards";
import { LocalDay } from "@/components/local-day";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/**
 * One certificate per cleared rung, laid out by level number rather than by
 * array index, up to the highest level cleared so far. A fast-forwarded level
 * (guide §1.4) leaves a real rung uncleared between two that are, and that gap
 * has to stay visible here as an empty frame rather than close up, or the wall
 * would quietly claim every level up to the highest one was cleared in order.
 */
export function CertificateWall() {
  if (CERTIFICATES.length === 0) return null;

  const maxLevel = Math.max(...CERTIFICATES.map((c) => c.level));
  const byLevel = new Map(CERTIFICATES.map((c) => [c.level, c]));
  const slots = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Certificates"
          note={`${CERTIFICATES.length} earned`}
          noteTone="good"
        />
        <SampleTag />
      </div>
      <ul className="flex flex-wrap gap-4">
        {slots.map((level) => {
          const cert = byLevel.get(level);
          if (!cert) {
            return (
              <li
                key={level}
                aria-hidden
                className="border-ink/20 h-[108px] w-40 shrink-0 rounded-xl border border-dashed"
              />
            );
          }

          const certBoss = boss(cert.bossId);
          const card = coachCard(cert.cardId);

          return (
            <li key={level} className="sticker flex w-40 shrink-0 flex-col gap-1 p-4">
              <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
                Level {cert.level}
              </span>
              <span className="font-figure text-ink text-lg leading-tight font-black uppercase">
                {cert.title}
              </span>
              <span className="font-label text-ink-soft text-xs">
                Issued <LocalDay iso={cert.issuedOn} />
              </span>
              <span className="text-ink-soft flex items-center gap-1 text-xs">
                {card ? (
                  <span aria-hidden className="leading-none">
                    {card.icon}
                  </span>
                ) : null}
                {certBoss ? certBoss.name : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
