"use client";

/**
 * Internal-only showcase for TilePopover, the one flexible pop-up that
 * replaces the five retired Vue surfaces (BRAIN-T260825-16, BRAIN-T260825-07).
 * Renders every body kind and every preset side by side against a fake tile
 * so the shape of the component can be checked visually without wiring it
 * into a real board. Not linked from any page or nav; reachable by URL only.
 * All copy here is placeholder and politically neutral by design, distinct
 * from any real topic content the game ships elsewhere.
 */

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { TilePopover } from "@/components/ui/tile-popover";
import {
  factCheckPreset,
  personalTastePreset,
  prioritiesPreset,
  resolveAgreementPreset,
  suggestedTopicsPreset,
} from "@/components/ui/tile-popover-presets";

function FakeTile({
  label,
  onClick,
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className="form-base input-primary w-40"
    >
      {label}
    </button>
  );
}

function DemoSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-gray p-6">
      <h2 className="font-primary text-p-lg text-neutral-black">{title}</h2>
      {note ? (
        <p className="max-w-xs text-center text-p-sm font-secondary text-gray">{note}</p>
      ) : null}
      {children}
    </section>
  );
}

function FactCheckDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <DemoSection title="Fact check" note="FactCheckModal.vue: one free-text field.">
      <FakeTile
        label="the coffee tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {submitted ? (
        <p className="text-p-sm font-secondary text-gray">Submitted: {submitted}</p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading={factCheckPreset.heading}
        subtitle={factCheckPreset.subtitle}
        glyph={factCheckPreset.glyph}
        confirmLabel={factCheckPreset.confirmLabel}
        body={{
          kind: "text",
          fields: [factCheckPreset.field],
          value,
          onChange: setValue,
        }}
        onConfirm={(result) => {
          setSubmitted(String(result));
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </DemoSection>
  );
}

function PersonalTasteDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <DemoSection
      title="Personal taste"
      note="PersonalTasteModal.vue: same shape as fact check, different copy."
    >
      <FakeTile
        label="the pizza tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {submitted ? (
        <p className="text-p-sm font-secondary text-gray">Submitted: {submitted}</p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading={personalTastePreset.heading}
        subtitle={personalTastePreset.subtitle}
        glyph={personalTastePreset.glyph}
        confirmLabel={personalTastePreset.confirmLabel}
        body={{
          kind: "text",
          fields: [personalTastePreset.field],
          value,
          onChange: setValue,
        }}
        onConfirm={(result) => {
          setSubmitted(String(result));
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </DemoSection>
  );
}

function PrioritiesDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(null);
  return (
    <DemoSection
      title="Priorities"
      note="PrioritiesModal.vue: two side-by-side fields, one value record instead of the retired JSON-encoded string."
    >
      <FakeTile
        label="the schedule tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {submitted ? (
        <p className="text-p-sm font-secondary text-gray">
          You: {submitted.mine} / Peer: {submitted.theirs}
        </p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading={prioritiesPreset.heading}
        subtitle={prioritiesPreset.subtitle}
        glyph={prioritiesPreset.glyph}
        confirmLabel={prioritiesPreset.confirmLabel}
        body={{
          kind: "text",
          fields: prioritiesPreset.fields,
          value,
          onChange: setValue,
        }}
        onConfirm={(result) => {
          setSubmitted(result as Record<string, string>);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </DemoSection>
  );
}

function ResolveAgreementDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <DemoSection
      title="Resolve agreement"
      note="ResolveAgreementModal.vue: pure confirm/cancel, no body. The no-close-button rule for a binding review is shown in the asymmetric demo below."
    >
      <FakeTile
        label="the thread tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {result ? (
        <p className="text-p-sm font-secondary text-gray">Result: {result}</p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading={resolveAgreementPreset.heading}
        subtitle={resolveAgreementPreset.subtitle}
        confirmLabel={resolveAgreementPreset.confirmLabel}
        cancelLabel={resolveAgreementPreset.openerCancelLabel}
        body={{ kind: "none" }}
        onConfirm={() => {
          setResult("agreed");
          setOpen(false);
        }}
        onCancel={() => {
          setResult("cancelled");
          setOpen(false);
        }}
      />
    </DemoSection>
  );
}

function SuggestedTopicsDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <DemoSection
      title="Suggested topics"
      note="SuggestedTopicsModal.vue: pick-one-from-a-list, submits on click, no confirm button. Placeholder topics, not the real shelf content."
    >
      <FakeTile
        label="the new-topic tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {picked ? (
        <p className="text-p-sm font-secondary text-gray">Picked: {picked}</p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading={suggestedTopicsPreset.heading}
        subtitle={suggestedTopicsPreset.subtitle}
        body={{
          kind: "list",
          groups: [
            {
              heading: "Everyday tradeoffs",
              items: [
                {
                  id: "mornings-nights",
                  label: "Mornings vs. nights: the better time to get things done",
                },
                { id: "cats-dogs", label: "Cats vs. dogs: the better pet" },
                { id: "coffee-tea", label: "Coffee vs. tea: the better morning drink" },
              ],
            },
            {
              heading: "Bigger swings",
              items: [
                {
                  id: "books-movies",
                  label: "Books vs. movies: which tells a story better",
                  tag: "custom",
                },
              ],
            },
          ],
          onSelect: (id) => {
            setPicked(id);
            setOpen(false);
          },
        }}
      />
    </DemoSection>
  );
}

function ChoiceDemo() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <DemoSection
      title="Pick one"
      note="A generic pick-one choice set. None of the five retired surfaces used this body kind; it exists so the capability is exercised somewhere."
    >
      <FakeTile
        label="the drink tile"
        onClick={() => setOpen(true)}
        buttonRef={anchorRef}
      />
      {submitted ? (
        <p className="text-p-sm font-secondary text-gray">Picked: {submitted}</p>
      ) : null}
      <TilePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        heading="Coffee or tea?"
        subtitle="Pick whichever one your morning actually runs on."
        body={{
          kind: "choice",
          options: [
            { id: "coffee", label: "Coffee" },
            { id: "tea", label: "Tea" },
          ],
          value,
          onChange: setValue,
        }}
        onConfirm={(result) => {
          setSubmitted(String(result));
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </DemoSection>
  );
}

function AsymmetricDemo() {
  const openerAnchorRef = useRef<HTMLButtonElement>(null);
  const peerAnchorRef = useRef<HTMLButtonElement>(null);
  const [openerOpen, setOpenerOpen] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);
  const [value, setValue] = useState<Record<string, string>>({});
  const [openerSubmitted, setOpenerSubmitted] = useState(false);
  const [openerTyping, setOpenerTyping] = useState(false);
  const [peerDecision, setPeerDecision] = useState<string | null>(null);

  const submittedFact = value.fact ?? "";

  return (
    <DemoSection
      title="Asymmetric two-player case"
      note="One popover, two viewers: the opener composes, the peer waits, sees a typing cue, then reviews and accepts or rejects. Open the opener tile first, type, and confirm, then open the peer tile."
    >
      <div className="flex gap-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-p-sm font-secondary text-gray">opener</p>
          <FakeTile
            label="the tea tile"
            onClick={() => setOpenerOpen(true)}
            buttonRef={openerAnchorRef}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-p-sm font-secondary text-gray">peer</p>
          <FakeTile
            label="the tea tile"
            onClick={() => setPeerOpen(true)}
            buttonRef={peerAnchorRef}
          />
        </div>
      </div>
      {peerDecision ? (
        <p className="text-p-sm font-secondary text-gray">
          Peer response: {peerDecision}
        </p>
      ) : null}

      <TilePopover
        open={openerOpen}
        onClose={() => setOpenerOpen(false)}
        anchorRef={openerAnchorRef}
        heading="Disagree on a fact?"
        subtitle="Source it together before you both move on."
        glyph={{ kind: "token", token: "🔍" }}
        body={{
          kind: "text",
          fields: [{ id: "fact", placeholder: "What's the fact?", autoFocus: true }],
          value,
          onChange: setValue,
          onTyping: () => setOpenerTyping(true),
        }}
        onConfirm={() => {
          setOpenerTyping(false);
          setOpenerSubmitted(true);
        }}
        onCancel={() => setOpenerOpen(false)}
        asymmetric={{ viewer: "opener", openerSubmitted }}
      />

      <TilePopover
        open={peerOpen}
        onClose={() => setPeerOpen(false)}
        anchorRef={peerAnchorRef}
        heading="Disagree on a fact?"
        subtitle="Source it together before you both move on."
        glyph={{ kind: "token", token: "🔍" }}
        body={{ kind: "none" }}
        onConfirm={() => {
          setPeerDecision("accepted");
          setPeerOpen(false);
        }}
        onCancel={() => {
          setPeerDecision("rejected");
          setPeerOpen(false);
        }}
        asymmetric={{
          viewer: "peer",
          openerSubmitted,
          openerTyping,
          peerPreview: <p>{submittedFact}</p>,
        }}
      />
    </DemoSection>
  );
}

export default function TilePopoverDemoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-offwhite p-10">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-primary text-p-lg text-neutral-black">
          TilePopover showcase
        </h1>
        <p className="max-w-md text-p-sm font-secondary text-gray">
          Internal only, not linked from anywhere. Every configuration the game needs,
          side by side against a fake tile. Click a tile to open its pop-up.
        </p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FactCheckDemo />
        <PersonalTasteDemo />
        <PrioritiesDemo />
        <ResolveAgreementDemo />
        <SuggestedTopicsDemo />
        <ChoiceDemo />
        <AsymmetricDemo />
      </div>
    </main>
  );
}
