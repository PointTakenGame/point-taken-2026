/**
 * The small set of TilePopover configurations the game actually needs,
 * carried over (in spirit, not in code) from the five retired Vue surfaces:
 * FactCheckModal, PersonalTasteModal, PrioritiesModal, ResolveAgreementModal,
 * SuggestedTopicsModal. Registry: BRAIN-T260825-16, BRAIN-T260825-07.
 *
 * These are static copy/shape only: heading, subtitle, glyph, field
 * placeholders, button labels. Every dynamic piece (open state, current
 * value, onChange/onConfirm, anchorRef, asymmetric state) still comes from
 * the caller, so this file carries zero game logic and no live/socket
 * state, matching TilePopover's own "renders and reports, never decides"
 * rule.
 */

import type { TilePopoverGlyph, TilePopoverTextField } from "./tile-popover";

export interface TilePopoverTextPreset {
  heading: string;
  subtitle: string;
  glyph: TilePopoverGlyph;
  field: TilePopoverTextField;
  peerReadyHeading: string;
  confirmLabel: string;
}

/** FactCheckModal.vue: "Disagree on a fact?" */
export const factCheckPreset: TilePopoverTextPreset = {
  heading: "Disagree on a fact?",
  subtitle: "First, take a few minutes to source the fact together. Can't agree?",
  glyph: { kind: "token", token: "🔍" },
  field: {
    id: "fact",
    placeholder: "What's the fact that you and your peer don't agree on?",
    autoFocus: true,
  },
  peerReadyHeading: "This is why we don't agree",
  confirmLabel: "DONE",
};

/** PersonalTasteModal.vue: "Disagree on taste?" (same shape as FactCheck,
 * differs only in copy: confirms the two surfaces collapse into one config). */
export const personalTastePreset: TilePopoverTextPreset = {
  heading: "Disagree on taste?",
  subtitle: "Describe your personal taste. It is what it is.",
  glyph: { kind: "token", token: "🍷" },
  field: {
    id: "taste",
    placeholder: "What is your and your peer's personal taste?",
    autoFocus: true,
  },
  peerReadyHeading: "Does this describe your and your peer's personal tastes?",
  confirmLabel: "DONE",
};

export interface TilePopoverPrioritiesPreset {
  heading: string;
  subtitle: string;
  glyph: TilePopoverGlyph;
  fields: [TilePopoverTextField, TilePopoverTextField];
  confirmLabel: string;
}

/** PrioritiesModal.vue: "Disagree on priorities?" Two side-by-side fields
 * instead of one; the retired version JSON-encoded both into a single
 * opaque string, which TilePopover does not need to replicate because its
 * `text` body kind natively supports multiple fields as a value record. */
export const prioritiesPreset: TilePopoverPrioritiesPreset = {
  heading: "Disagree on priorities?",
  subtitle: "You might each lean in different directions on this one.",
  glyph: { kind: "token", token: "⚖️" },
  fields: [
    { id: "mine", placeholder: "Your priority", autoFocus: true },
    { id: "theirs", placeholder: "Your peer's priority" },
  ],
  confirmLabel: "DONE",
};

export interface TilePopoverResolveAgreementPreset {
  heading: string;
  subtitle: string;
  confirmLabel: string;
  cancelLabel: string;
  openerCancelLabel: string;
}

/** ResolveAgreementModal.vue: pure confirm/cancel, no body. The opener's
 * glyph token (which resolution is being proposed, e.g. agree-to-agree vs.
 * agree-to-disagree) is domain state, so it stays with the caller rather
 * than living in this static preset. */
export const resolveAgreementPreset: TilePopoverResolveAgreementPreset = {
  heading: "Resolve this thread?",
  subtitle: "Your partner wants to resolve this thread. Do you agree?",
  confirmLabel: "AGREE",
  cancelLabel: "REJECT",
  openerCancelLabel: "CANCEL",
};

export interface TilePopoverSuggestedTopicsPreset {
  heading: string;
  subtitle: string;
}

/** SuggestedTopicsModal.vue: pick-one-from-a-list. Grouped/tagged topic
 * content itself is domain data (and, in the retired file, real political
 * examples), so only the chrome copy lives here. */
export const suggestedTopicsPreset: TilePopoverSuggestedTopicsPreset = {
  heading: "Pick a new topic",
  subtitle: "Choose one below, or write your own.",
};
