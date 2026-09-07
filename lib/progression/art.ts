/**
 * Where Rannie's drawn artwork lives, and which of our ids each piece belongs
 * to (Steve, 2026-09-07).
 *
 * Her Figma file `Pointaken_2026` (`60wr75TY7I95UnL6jkLz2J`) draws three sets
 * we did not have art for: the rule-card illustration panels, the badge
 * glyphs, and the boss portraits. Steve's ruling is to take her artwork and
 * keep our names, our ids, and our level order, so this module is the one
 * place that joins the two. Nothing else imports a file path.
 *
 * The boss join is not the loose remap it looked like: her ladder is eight
 * bosses in a different order, but the four names she uses at the levels we
 * have built are letter-identical to ours, so each portrait attaches to the
 * boss it was drawn for and only the level number moves.
 *
 * Levels 5 to 8 have no art here on purpose. She drew four more bosses
 * (Kranky Karl, Twisty Thibault, Cagey Chandni, Hasty Hakeem) but those are
 * rules nobody has written, and a named locked tile is a promise (Steve,
 * 2026-09-03, on the same question for rule cards 5 to 11). Their renders are
 * kept out of the build at `_local/mock-cards-badges/art/boss/`.
 *
 * Every value is a public path, so a missing entry renders as no art rather
 * than a broken build. Callers fall back to the emoji already on the record.
 */

/** Rule-card illustration panels, keyed by `CoachCard.id`. */
export const CARD_ART: Readonly<Record<string, string>> = {
  you_is_taboo: "/art/cards/you_is_taboo.png",
  stick_to_root: "/art/cards/stick_to_root.png",
  no_exaggeration: "/art/cards/no_exaggeration.png",
  help_me_understand: "/art/cards/help_me_understand.png",
};

/** Badge glyphs, keyed by `Badge.id`. White line art on transparent. */
export const BADGE_ART: Readonly<Record<string, string>> = {
  "mutual-respect": "/art/badges/mutual-respect.png",
  "honest-thinking": "/art/badges/honest-thinking.png",
  "shared-facts": "/art/badges/shared-facts.png",
  "resolve-first-thread": "/art/badges/resolve-first-thread.png",
  "call-broken-rule": "/art/badges/call-broken-rule.png",
  "finish-one-game": "/art/badges/finish-one-game.png",
  compression: "/art/badges/compression.png",
  "stick-to-root-1": "/art/badges/stick-to-root-1.png",
  "stick-to-root-2": "/art/badges/stick-to-root-2.png",
  "stick-to-root-3": "/art/badges/stick-to-root-3.png",
  "no-exaggeration-1": "/art/badges/no-exaggeration-1.png",
  "no-exaggeration-2": "/art/badges/no-exaggeration-2.png",
  "no-exaggeration-3": "/art/badges/no-exaggeration-3.png",
  "help-me-understand-1": "/art/badges/help-me-understand-1.png",
  "help-me-understand-2": "/art/badges/help-me-understand-2.png",
};

/** Boss portraits, keyed by `Boss.id`. Transparent, roughly square. */
export const BOSS_ART: Readonly<Record<string, string>> = {
  "bashful-bob": "/art/bosses/bashful-bob.png",
  "rambling-rosa": "/art/bosses/rambling-rosa.png",
  "braggy-bogdan": "/art/bosses/braggy-bogdan.png",
  "sloppy-salma": "/art/bosses/sloppy-salma.png",
};

/**
 * The plaque colour each boss is drawn against, keyed by `Boss.id`.
 *
 * Her figures are single-hue flat illustrations and each one is drawn in the
 * colour of the plaque it stands on, so the two travel together. Our level
 * order is not hers, which is why this is keyed by boss and not by level: a
 * boss who moved from her level 6 to our level 2 keeps the colour she was
 * drawn in, and only the number on the chip changes. A boss with no entry
 * falls back to the level spectrum.
 */
export const BOSS_PLAQUE_INK: Readonly<Record<string, string>> = {
  "bashful-bob": "#3ab0a4",
  "rambling-rosa": "#c162c6",
  "braggy-bogdan": "#8a5fd0",
  "sloppy-salma": "#a8bb3c",
};

export function bossPlaqueInk(id: string): string | null {
  return BOSS_PLAQUE_INK[id] ?? null;
}

export function cardArt(id: string): string | null {
  return CARD_ART[id] ?? null;
}

export function badgeArt(id: string): string | null {
  return BADGE_ART[id] ?? null;
}

export function bossArt(id: string): string | null {
  return BOSS_ART[id] ?? null;
}
