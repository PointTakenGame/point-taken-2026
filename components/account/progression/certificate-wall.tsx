import type { PlayerAwards } from "@/lib/db/awards";
import { boss } from "@/lib/progression/sample";
import { certificatesFor } from "@/lib/progression/state";
import { coachCard } from "@/lib/coach/cards";
import { LocalDay } from "@/components/local-day";
import { Panel, SectionHeading } from "@/components/account/account-shell";

/**
 * One certificate per cleared rung, laid out by level number rather than by
 * array index, up to the highest level cleared so far. A fast-forwarded level
 * (guide §1.4) leaves a real rung uncleared between two that are, and that gap
 * has to stay visible here as an empty frame rather than close up, or the wall
 * would quietly claim every level up to the highest one was cleared in order.
 *
 * Real since 0014_awards.sql: every card on this wall is a certificate_granted
 * event, and the date on it is the date it was issued, not the date it is read.
 * An account with none gets no panel at all rather than an empty one.
 */
export function CertificateWall({ awards }: { awards: PlayerAwards }) {
  const certificates = certificatesFor(awards);
  if (certificates.length === 0) return null;

  const maxLevel = Math.max(...certificates.map((cert) => cert.level));
  const byLevel = new Map(certificates.map((cert) => [cert.level, cert]));
  const slots = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Certificates"
          note={`${certificates.length} earned`}
          noteTone="good"
        />
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

          const certBoss = cert.bossId ? boss(cert.bossId) : undefined;
          const card = coachCard(cert.cardId ?? "");

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
