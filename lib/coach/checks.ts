/**
 * The fallacy vocabulary, ported from the Northwestern study pipeline.
 *
 * Source: `agents.py` at commit b0d03ea (2026-06-08), recovered as the bundle
 * staged at `point-taken-biz/data/corey-agent-bundle-260717/`. The prompt text
 * below is his, not a paraphrase of it, because the thresholds in it are the
 * part that took a year of eval runs to settle and cannot be re-derived from a
 * summary.
 *
 * PORT-GAP(nu-2026-08-12): the newest deploy in the NU account is
 * v-202608121440 (2026-08-12) and we do not have that bundle, so anything he
 * changed between 2026-06-08 and 2026-08-12 is unknown here. Every place this
 * file departs from his text on purpose carries a PORT-NOTE marker, so a later
 * diff against the newer bundle can tell a deliberate change from a stale one.
 *
 * Two departures are workspace rules and are not negotiable:
 *   - No em dashes anywhere in our output, so his punctuation is rewritten to
 *     commas and periods. No wording changed with it.
 *   - Every politically legible example needs an equally vivid counterpart on
 *     the other side. His examples lean in several places, most sharply in
 *     CHECK 6 where both flagged straw men are straw men of the same side. The
 *     fix is to ADD a mirror beside each, never to delete his text.
 */

/** His `SCHEMA_VERSION`, carried verbatim so drift is detectable later. */
export const NU_SCHEMA_VERSION = "2026-04-16";

/** His `THRESHOLD_VERSION`. The number the DO-NOT-FLAG rules below belong to. */
export const NU_THRESHOLD_VERSION = "2026-04-17";

/**
 * His `PROMPT_VERSIONS`, verbatim. We run one call rather than his three, so
 * only `analysis` and `explanation` describe text we actually send; the other
 * three are the older chain and are carried so a log row from either pipeline
 * can be read with the same key set.
 */
export const NU_PROMPT_VERSIONS = {
  analysis: "2026-05-11-v3",
  structure: "2026-05-11-v3",
  reasoning: "2026-05-01-v4",
  clarify: "2026-05-01-v2",
  explanation: "2026-05-01-v2",
} as const;

/** The nine checks, in his order. Order is significant: the fallback ladder walks it. */
export const NINE_CHECK_KEYS = [
  "personal_attack",
  "not_a_statement",
  "overgeneralization",
  "exaggeration",
  "false_causation",
  "straw_man",
  "appeal_to_authority",
  "anecdotal_data",
  "whataboutism_red_herring",
] as const;

export type CheckKey = (typeof NINE_CHECK_KEYS)[number];

/**
 * The five he surfaces to a player, and the four he detects but deliberately
 * never shows. That split is a study design decision, not an oversight: the
 * research-only four are logged so the corpus has them and withheld so the
 * player is not taught nine rules at once.
 */
export const UI_CHECK_KEYS: readonly CheckKey[] = [
  "overgeneralization",
  "false_causation",
  "personal_attack",
  "exaggeration",
  "straw_man",
];

export const RESEARCH_ONLY_CHECK_KEYS: readonly CheckKey[] = [
  "not_a_statement",
  "appeal_to_authority",
  "anecdotal_data",
  "whataboutism_red_herring",
];

/** His TASK 1 structure verdict. Kept as research metadata only, see `cardFor`. */
export type Relation = "supports" | "rebuts" | "irrelevant";

export const RELATIONS: readonly Relation[] = ["supports", "rebuts", "irrelevant"];

/** What one reading found. The model reports this; code turns it into a card. */
export interface CheckFindings {
  relation: Relation;
  violations: CheckKey[];
  /** Ours, not his. The literal test behind the Stick to the Thread's Root card. */
  offRoot: boolean;
  clarificationNeeded: boolean;
}

/**
 * Which card each check may be shown as. A check with `null` here is detected
 * and logged and never surfaced, either because it is one of his research-only
 * four or because our deck has no card for it.
 *
 * PORT-NOTE(false_causation): he surfaces this one, we cannot. Our first
 * release deck has four cards and none of them is a causal leap, and the coach
 * may only cite cards (see `cards.ts`). So it is logged and withheld. If a
 * fifth card is ever cut, this is the first candidate.
 *
 * PORT-NOTE(whataboutism_red_herring): he keeps this research-only, we surface
 * it. Changing the subject is exactly what Stick to the Thread's Root is about,
 * so withholding it here would leave the card with less to say than it should
 * have. This moves one check across his UI boundary in the other direction.
 */
export const CHECK_TO_CARD: Record<CheckKey, string | null> = {
  personal_attack: "you_is_taboo",
  not_a_statement: null,
  overgeneralization: "no_exaggeration",
  exaggeration: "no_exaggeration",
  false_causation: null,
  straw_man: "stick_to_root",
  appeal_to_authority: null,
  anecdotal_data: null,
  whataboutism_red_herring: "stick_to_root",
};

/**
 * At most one card is ever cited, so ties need an order. This is his own
 * fallback ladder order: the person first, then what the reason is about, then
 * how strongly it is put, then whether it can be answered at all.
 */
export const CARD_PRECEDENCE: readonly string[] = [
  "you_is_taboo",
  "stick_to_root",
  "no_exaggeration",
  "help_me_understand",
];

/**
 * His `VALID_SHORT_CLAIM_MARKERS`, verbatim. A short tile carrying one of these
 * is doing argumentative work and is not merely terse.
 */
export const VALID_SHORT_CLAIM_MARKERS: readonly string[] = [
  "because",
  "should",
  "can",
  "could",
  "helps",
  "hurts",
  "limits",
  "improves",
  "reduces",
  "increases",
  "is unfair",
  "is bad",
  "is good",
  "is harmful",
  "is useful",
  "is distracting",
  "is dangerous",
  "makes",
];

export const GROUND_RULES = `======================================
GROUND RULES
======================================
RULE 0-A: BIAS TOWARD FALSE. When in doubt, do NOT flag. Only flag when confident the definition is clearly met.
RULE 0-B: EVALUATE THE TILE AS WRITTEN. Do not infer intent. Judge only the words on the page.
RULE 0-C: ALL CHECKS ARE INDEPENDENT. Run every check in order regardless of prior results. A tile can fail multiple checks.
RULE 0-D: SHORT, VAGUE, OR IMPRECISE STATEMENTS ARE NOT FALLACIES. "Things have gotten worse" or "This is wrong" is vague, not a fallacy.`;

/**
 * His `_nine_check_instructions()`. Repunctuated, with mirrored examples added
 * where his lean one way. Added lines are marked with a leading "ALSO" so a
 * diff against the newer NU bundle stays readable.
 *
 * PORT-NOTE(check-3-definition): CHECK 3 has no DEFINITION line in his source,
 * unlike the other eight. Left as he wrote it. Conditions A through D already
 * do the defining, and inventing a definition line would change calibrated
 * behaviour for no measured reason.
 */
export const NINE_CHECK_INSTRUCTIONS = `${GROUND_RULES}

======================================
THE NINE CHECKS, IN ORDER
======================================

CHECK 1: PERSONAL ATTACK (Ad Hominem)
DEFINITION: Attacks the person's character, intelligence, background, motives, or identity instead of engaging with their argument.
TO FLAG, ALL must be true:
  - Targets the person's identity (not the ideas)
  - The attack is about who they ARE, not what they ARGUED
  - No engagement with the substance of any argument is present
DO NOT FLAG IF:
  AD-1: Criticism targets an argument, policy, idea, or reasoning ("This reasoning is flawed" -> NOT ad hominem)
  AD-2: Strong but argument-directed critique ("This policy is reckless" -> NOT ad hominem)
  AD-3: Unsure whether target is person or idea -> default false (Rule 0-A)
FLAGGED: "Only someone completely ignorant would argue that." / "She has no credibility because she never went to university."
NOT FLAGGED: "This argument is logically inconsistent." / "The evidence cited here is unreliable."

CHECK 2: NOT A STATEMENT (Invalid Format)
DEFINITION: The tile is phrased as a question rather than a statement. Questions make no claim.
TO FLAG, the following must be true:
  - Ends with a question mark, OR
  - Grammatically structured as a direct question (inverted subject-verb: "Is it not true that...", "Don't you think...", "Wouldn't it be better if...")
DO NOT FLAG IF:
  QS-1: Rhetorical framing that is fundamentally a statement ("The fact that crime rose proves the policy failed" -> statement)
  QS-2: Question embedded inside a statement ("One must ask whether the evidence supports this, and it clearly does not")
FLAGGED: "Don't you think all politicians are corrupt?" / "Isn't it obvious that this policy has failed?"
NOT FLAGGED: "This policy has clearly failed." / "The evidence does not support this conclusion."

CHECK 3: OVERGENERALIZATION
TO FLAG, ALL FOUR must be true:
  - CONDITION A, SCALE WORD PRESENT: Explicit universal or near-universal quantifier:
    UNIVERSAL: all, every, always, never, everyone, nobody, no one, none, everywhere, without exception, invariably, universally
    NEAR-UNIVERSAL: most, almost all, virtually all, the vast majority of, nearly everyone
    STRONG IMPLICIT: unqualified noun phrase applying a non-trivial trait to an ENTIRE named group with no qualifier ("Politicians are corrupt" = implicit "all politicians")
  - CONDITION B, NAMED GROUP EXISTS: A clearly identifiable group the scale claim applies to
  - CONDITION C, NON-TRIVIAL PROPERTY: A meaningful behavioral, moral, cognitive, or evaluative trait applied to the whole group, not a trivially true or widely accepted fact
  - CONDITION D, NOT A SOLID FACT: The statement is not a fact that science or history agrees with
DO NOT FLAG IF:
  OG-0: Data-supported generalization (>80% data supports "most"; >95% supports "almost all"); universally agreed facts ("No one can survive without equipment in space")
  OG-1: Scope word is a PARTIAL quantifier: many, some, a few, several, certain, various
  OG-2: Short opinion/reaction with no named group ("This argument is weak")
  OG-3: Vague statement with no named group ("Things have gotten worse")
  OG-4: Specific scoped population (study participants) without generalizing beyond it
  OG-5: Hedged by attribution to others ("Some researchers argue that...")
  OG-6: FREQUENCY HEDGE, not a scale word: often, frequently, commonly, usually, generally, typically, tends to, in many cases, more often than not. These state a tendency, not a universal, and CONDITION A is not met by them ("Politicians often break promises" -> NOT flagged)
  OG-7: If in doubt -> false
FLAGGED: "All politicians are corrupt." / "Most young people have no interest in history."
NOT FLAGGED: "Many voters feel disconnected." / "This argument is unconvincing." / "Tuition debt stops low-income students from graduating."
ALSO NOT FLAGGED: "Licensing rules keep many small businesses from ever opening." / "Unions often slow down reform." / "Deregulated markets frequently hurt consumers."

CHECK 4: EXAGGERATION (Hyperbole Used as Fact)
DEFINITION: A claim presented as factual but so extreme or disproportionate relative to available evidence that it distorts reality in a way that misleads. Does NOT require a scale word. It is about magnitude.
TO FLAG, ALL must be true:
  - Presented as factual (not explicitly as opinion or rhetorical emphasis)
  - Magnitude clearly and verifiably disproportionate to what evidence could plausibly support
  - Would materially mislead a reasonable reader
DO NOT FLAG IF:
  EX-1: Clearly rhetorical emphasis ("This is the most important issue of our time" -> opinion/emphasis)
  EX-2: Opinion about severity with no verifiable factual content ("This is a massive problem" -> vague emphasis)
  EX-3: Plausibly true even if strong ("This policy has caused enormous harm" -> strong but plausible)
  EX-4: If in doubt -> false
FLAGGED: "This tax increase will completely destroy the entire economy." / "Nobody has ever successfully argued against this position."
ALSO FLAGGED: "This tax cut will completely wipe out every public service in the country."
NOT FLAGGED: "This is a very serious problem." / "The consequences could be devastating."

CHECK 5: FALSE CAUSATION
DEFINITION: Asserts X caused Y based solely on temporal sequence or correlation, without establishing a causal mechanism and without ruling out confounders.
TO FLAG, ALL must be true:
  - CONDITION A, EXPLICIT CAUSAL ASSERTION: Uses causal language to assert X caused Y:
    caused, led to, resulted in, is why, proves that, demonstrates that [causally], is the reason, therefore [causal], clearly [causal], must be because, is responsible for, shows that [causally], which is why
  - CONDITION B, INSUFFICIENT BASIS: Rests on temporal sequence alone, correlation alone, no mechanism described, no confounders ruled out
DO NOT FLAG IF:
  FC-1: Explicitly acknowledges reporting correlation, not asserting causation
  FC-2: Causal language is hedged ("may contribute to", "might be related to", "could influence")
  FC-3: Well-established scientific consensus ("Smoking causes cancer")
  FC-4: A plausible mechanism IS described
  FC-5: Describes a barrier, mechanism, or plausible consequence without asserting a surprising causal chain ("Tuition debt stops low-income students from graduating" -> NOT flagged)
  FC-6: If in doubt -> false
FLAGGED: "Crime rose after the mayor took office, so his policies must be making the city less safe." / "Ever since the reading program started, test scores improved, so clearly the program works."
ALSO FLAGGED: "Wages went up the year after the new labor law passed, so the law is why."
NOT FLAGGED: "Sleep deprivation may contribute to lower performance." / "Tuition debt stops many students from finishing college." / "Phone bans can improve grades."

CHECK 6: STRAW MAN
DEFINITION: Misrepresents, distorts, or exaggerates an opposing position to make it easier to attack.
TO FLAG, ALL must be true:
  - References or implies an opposing position or argument
  - The opposing position as described is a distortion or oversimplification of what the opposition actually argues
  - Attacks the distorted version rather than the real one
DO NOT FLAG IF:
  SM-1: Accurately describes the opposing position before critiquing it
  SM-2: No opposing position is referenced at all
  SM-3: The simplification is reasonable and fair
  SM-4: If in doubt -> false
FLAGGED: "Those who oppose this policy just want criminals to run free." / "Environmentalists want to shut down all industry and send us back to the Stone Age."
ALSO FLAGGED: "Those who support this policy just want everyone locked up forever." / "People who question emissions rules want the air to be unbreathable."
NOT FLAGGED: "Opponents argue it will increase costs, but evidence shows otherwise."

CHECK 7: APPEAL TO AUTHORITY
DEFINITION: Uses endorsement of a person, institution, or source as the sole justification, where either (a) the authority is not a genuine expert in the relevant field, OR (b) the appeal is used as a substitute for evidence.
TO FLAG, ALL must be true:
  - An authority is cited
  - Their endorsement is presented as the PRIMARY or ONLY reason to accept the claim
  - EITHER the authority lacks genuine expertise in the specific field, OR no actual evidence or reasoning accompanies the appeal
DO NOT FLAG IF:
  AA-1: Authority IS a genuine expert AND citation accompanies other evidence/reasoning
  AA-2: Authority cited as one piece of evidence among several
  AA-3: Acknowledges uncertainty while citing authority
  AA-4: If in doubt -> false
FLAGGED: "This economic policy must be correct because a famous actor endorsed it." / "It must be true, a Nobel Prize winner said so." (sole evidence, no reasoning)
NOT FLAGGED: "The IPCC, drawing on thousands of peer-reviewed studies, concludes temperatures are rising."
ALSO NOT FLAGGED: "The Congressional Budget Office, working from its published cost models, projects the deficit will grow under this plan."

CHECK 8: ANECDOTAL DATA
DEFINITION: Uses a single personal story, isolated example, or small number of cases as primary evidence for a broad general claim.
TO FLAG, ALL must be true:
  - A broad general claim is being made
  - Evidence is a single case, personal experience, or small number of examples
  - Anecdote is presented as sufficient evidence for the broad claim, not merely as illustration
DO NOT FLAG IF:
  AN-1: Anecdote offered as illustration alongside other evidence
  AN-2: Claim is narrow and scoped to the individual case
  AN-3: Explicitly acknowledges the anecdote is limited
  AN-4: If in doubt -> false
FLAGGED: "My uncle smoked his whole life and lived to 95, so smoking can't be that harmful." / "I know someone who got the vaccine and got sick, so vaccines clearly cause illness."
ALSO FLAGGED: "Everyone in my family got the vaccine and stayed healthy, so it plainly works for everybody."
NOT FLAGGED: "Research shows vaccines are safe, and my own experience was consistent with that."

CHECK 9: WHATABOUTISM / RED HERRING
DEFINITION:
  WHATABOUTISM: Deflects from a criticism by pointing to a different issue rather than addressing the original point.
  RED HERRING: Introduces an irrelevant point that distracts from the actual argument.
TO FLAG, ANY must be true:
  - WHATABOUTISM: Responds to a claim by redirecting to a different actor's behavior rather than engaging with the original claim
  - RED HERRING: Introduces a point clearly irrelevant to the matter being argued, serving only to distract
DO NOT FLAG IF:
  WH-1: Comparison IS logically relevant to establishing consistency or hypocrisy in applying a principle
  WH-2: The introduced point genuinely bears on the argument
  WH-3: If in doubt -> false
FLAGGED: "Why are we talking about our carbon emissions when China pollutes far more?" / "This politician's spending is criticized, but what about the other party's?"
ALSO FLAGGED: "Why are we talking about benefit fraud when corporate tax avoidance costs far more?"
NOT FLAGGED: "Before accepting this argument, consider how this principle applies in other contexts."

======================================
DECISION PROCEDURE
======================================
For each check in order:
  STEP A: Read the definition.
  STEP B: Check all TO-FLAG conditions. Are ALL required conditions met? If NO, detected=false.
  STEP C: Check DO-NOT-FLAG rules one by one. Does ANY rule apply? If YES, detected=false. If NO, detected=true. Extract the trigger phrase.
  STEP D: Move to next check regardless of result.
After all nine: report every check key that came out detected=true. If none, report an empty list.`;

/**
 * His TASK 3 clarity gate, verbatim in substance. Kept short because our
 * Help Me Understand card carries its own wording in `cards.ts`.
 */
export const CLARITY_INSTRUCTIONS = `Flag clarification ONLY when the tile is so vague that another player cannot meaningfully respond. Do NOT flag because the tile is short, informal, or an opinion.
SHOULD FLAG: "That is just wrong." / "This causes problems." / "It is bad."
SHOULD NOT FLAG: "Phones can distract students." / "This policy is unfair." / "Tuition debt makes college harder."`;

/** His `normalized_text`. */
function normalizedText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * His `is_valid_short_claim`. A guard against the clarity check firing on every
 * terse tile: ten words or fewer plus an argumentative marker is a real claim.
 */
export function isValidShortClaim(text: string, findings: CheckFindings): boolean {
  const lowered = normalizedText(text);
  const words = lowered.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;
  if (findings.relation === "irrelevant" || findings.violations.length > 0) return false;
  return VALID_SHORT_CLAIM_MARKERS.some((marker) => lowered.includes(marker));
}

/**
 * His `suppress_false_positive_clarify`.
 *
 * PORT-NOTE(suppressor): porting this changed one of our own fixtures. The
 * "adverse selection" case in `fixtures.ts` was seven words and contained
 * "because", so this would have unflagged a tile the bake-off counts as a
 * correct Help Me Understand. The suppressor is the right behaviour and the
 * fixture was the weaker artifact, so the fixture was rewritten rather than
 * this being dropped. See the pair note in `fixtures.ts`.
 */
export function suppressFalsePositiveClarify(
  text: string,
  findings: CheckFindings,
): CheckFindings {
  if (!findings.clarificationNeeded) return findings;
  if (!isValidShortClaim(text, findings)) return findings;
  return { ...findings, clarificationNeeded: false };
}

/** His `_within_limit`. Returns the text only if it would fit on a tile. */
export function withinTileLimit(
  text: string | null | undefined,
  limit: number,
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= limit ? trimmed : null;
}

/**
 * The one card to cite, or null for silence. Code decides this, not the model,
 * because every threshold above attaches to a check and none of it attaches to
 * a card.
 *
 * PORT-NOTE(relation): `relation === "irrelevant"` deliberately does NOT
 * produce a card. His IRRELEVANT triggers include personal attack, which has
 * its own card, and "wrong side", which is a game rule rather than anything the
 * coach should speak about. Routing it to Stick to the Thread's Root would
 * manufacture false alarms, and a false alarm is the one failure that costs the
 * whole feature. It stays research metadata.
 */
export function cardFor(findings: CheckFindings): string | null {
  const fromChecks = new Set<string>();
  for (const violation of findings.violations) {
    const card = CHECK_TO_CARD[violation];
    if (card) fromChecks.add(card);
  }
  if (fromChecks.size > 0) {
    return CARD_PRECEDENCE.find((card) => fromChecks.has(card)) ?? null;
  }

  // Only now, when none of his nine found anything, do our two additions get a
  // turn. This ranking is not a view about which mistake is worse. His checks
  // carry a year of eval runs behind their thresholds; off_root and the clarity
  // flag are a sentence of instruction each. Measured on the fixtures, letting
  // off_root outrank a calibrated finding cost three of eight correct cards,
  // because a tile that plainly overstates its case also reads as "about a
  // different question" to a model asked in the abstract. When a calibrated
  // signal and an uncalibrated one disagree, the calibrated one is right.
  if (findings.offRoot) return "stick_to_root";
  if (findings.clarificationNeeded) return "help_me_understand";
  return null;
}

/**
 * His `map_first_wave_categories`, in his emit order. UI-surfaced categories
 * only: a research-only violation is readable from the violations list and
 * never appears here.
 */
export function firstWaveCategories(findings: CheckFindings): string[] {
  const violations = new Set(findings.violations);
  const out: string[] = [];
  if (findings.clarificationNeeded) out.push("needs_more_detail");
  if (violations.has("overgeneralization")) out.push("too_broad");
  if (violations.has("false_causation")) out.push("causal_leap");
  if (violations.has("exaggeration")) out.push("exaggeration");
  if (violations.has("personal_attack")) out.push("personal_attack");
  if (violations.has("straw_man")) out.push("straw_man");
  if (findings.offRoot) out.push("needs_clearer_connection");
  return out;
}

/** His `map_error_types`, adapted: relation first, then UI violations, then clarity. */
export function errorTypes(findings: CheckFindings): string[] {
  const out: string[] = [];
  if (findings.relation === "irrelevant") out.push("irrelevant_rebuttal");
  for (const key of findings.violations) {
    if (UI_CHECK_KEYS.includes(key)) out.push(key);
  }
  if (findings.clarificationNeeded) out.push("clarification_needed");
  return out;
}

/**
 * His `fallback_explanation`, in his exact branch order, repunctuated. This is
 * what the player reads when the model detected something but wrote nothing
 * usable alongside it. Deterministic, no model call.
 *
 * PORT-NOTE(legacy-dual-read): his first two generics test
 * `reasoning.get(key) or key in violations`, a leftover from the three-agent
 * chain where the per-check dict and the violations list could disagree. We
 * emit one violations list, so only the `in violations` half is ported.
 */
export function fallbackFeedback(findings: CheckFindings): string | null {
  const violations = new Set(findings.violations);

  if (violations.has("personal_attack")) {
    return "Arguments should respond to the claim, not the person making it.";
  }
  if (findings.relation === "irrelevant") {
    return "This doesn't connect to the debate. Try making a point about the actual topic.";
  }
  if (violations.has("overgeneralization")) {
    return "This claim is broader than the evidence supports. Try narrowing the scope.";
  }
  if (violations.has("false_causation")) {
    return "This claim assumes a causal link that needs more support.";
  }
  if (violations.has("exaggeration")) {
    return "This claim is more extreme than the evidence supports.";
  }
  if (violations.has("not_a_statement")) {
    return "Arguments must be statements, not questions. Rephrase as a claim.";
  }
  if (violations.has("straw_man")) {
    return "This misrepresents the opposing argument. Engage with what they actually said.";
  }
  if (violations.has("appeal_to_authority")) {
    return "Citing an authority alone isn't enough. Explain why the evidence supports the claim.";
  }
  if (violations.has("anecdotal_data")) {
    return "A single example isn't sufficient to support a broad claim.";
  }
  if (violations.has("whataboutism_red_herring")) {
    return "This deflects from the argument. Address the actual point being made.";
  }
  if (findings.offRoot) {
    return "This may be worth saying, but it doesn't bear on the claim at the root of this thread.";
  }
  if (findings.clarificationNeeded) {
    return "Try being more specific so other players can respond to your point.";
  }
  return null;
}

/**
 * His TASK 1, repunctuated.
 *
 * PORT-GAP(wrong-side): his trigger (e), a tile that argues the opposite of the
 * player's assigned side, is dropped here. It needs the player's side and our
 * `CoachInput` does not carry one. It is cheap to add later and costs nothing
 * today, because `relation` is research metadata and never produces a card.
 */
export const STRUCTURE_INSTRUCTIONS = `Classify the reason's relationship to the claim at the root of its thread:
- SUPPORTS: adds evidence, reasoning, or agreement with the root
- REBUTS: contradicts, challenges, or undermines the root
- IRRELEVANT: does not function as a valid debate argument

Classify as IRRELEVANT if any of the following apply:
  a) Personal attack: targets the opponent as a person rather than addressing their argument
  b) Off-topic statement: no bearing on the debate topic
  c) Personal or emotional statement: expresses the speaker's own feelings, not a debate claim
  d) Nonsense or gibberish
  e) Whataboutism or deflection: responds to the root by pivoting to a completely different subject rather than engaging with the actual argument. Only flag when the pivot subject is genuinely unrelated to the debate topic.

Do NOT classify as IRRELEVANT just because the argument addresses a different aspect of the same debate. Valid rebuttals may address costs, tradeoffs, consequences, or alternative considerations, and these are relevant even if they do not directly mirror the root's exact claim.
  - "Many small businesses would struggle to afford higher wages" is a valid cost tradeoff in a minimum wage debate, even if the root is about worker affordability.
  - "Workers with more take-home pay spend it in the same local economy" is likewise valid, even if the root is about employer costs.`;
