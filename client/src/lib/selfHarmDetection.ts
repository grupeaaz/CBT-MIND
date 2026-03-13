// First-layer self-harm / suicide risk detection based on Prevension.YAML
// Implements keyword scoring, modifiers, false-positive filtering, and threshold levels.

export type RiskLevel = "none" | "medium" | "high" | "critical";

export interface DetectionResult {
  riskLevel: RiskLevel;
  message: string;
}

// ── False-positive filters ───────────────────────────────────────────────────

const FIGURATIVE_PHRASES = [
  "kill time", "kill the process", "kill the lights", "kill the idea",
  "this workload is killing me", "this homework is killing me",
  "that joke killed me", "this exam makes me want to die",
  "this meeting makes me want to die", "that food was so bad i want to die",
];

const EDUCATIONAL_CONTEXT_WORDS = [
  "research", "study", "statistics", "article", "news",
  "prevention", "awareness", "psychology paper",
];

const MEDIA_CONTEXT_WORDS = [
  "song", "lyrics", "movie", "show", "quote",
  "character", "book", "tv series",
];

// ── Keyword lists by category (weights from YAML) ───────────────────────────

const DIRECT_SUICIDE_KEYWORDS = [
  "kill myself", "killing myself", "i want to die", "i want to kill myself",
  "i will kill myself", "going to kill myself", "end my life", "ending my life",
  "take my life", "taking my life", "i should die", "i deserve to die",
  "better off dead", "wish i was dead", "wish i were dead",
  "i want to disappear forever", "i can't go on", "life is not worth living",
  "i don't want to live", "i don't want to be alive", "i want everything to end",
  "i want it all to stop", "i want out of life", "i am done with life",
  "i will end it tonight", "i will end everything", "this is my last day",
  "i am ready to die", "i will not be here tomorrow", "tonight is my last night",
]; // base weight: 10

const SUICIDE_PLANNING_KEYWORDS = [
  "suicide plan", "planning suicide", "how to kill myself",
  "how to commit suicide", "best way to die", "painless way to die",
  "fastest way to die", "easiest way to die", "least painful way to die",
  "ways to kill myself", "ways to die", "lethal dose", "fatal dose",
  "suicide method", "suicide methods", "writing a suicide note",
  "my suicide note", "goodbye letter", "final goodbye message",
  "giving away my belongings", "saying goodbye to everyone",
  "preparing to die", "where to buy poison", "jump off bridge",
  "jump off building", "overdose amount",
]; // base weight: 9

const SELF_HARM_KEYWORDS = [
  "self harm", "self-harm", "cut myself", "cutting myself",
  "cutting my arms", "cutting my wrists", "burn myself", "burning myself",
  "hurt myself", "hurting myself", "harm myself", "make myself bleed",
  "scratch until bleeding", "stab myself", "choke myself", "hang myself",
  "overdose", "od on pills", "take all my pills", "drink poison",
  "swallow pills", "slit my wrists", "drown myself", "suffocate myself",
  "poison myself",
]; // base weight: 8

const SLANG_KEYWORDS = [
  "kms", "kys", "unalive myself", "unalive me", "off myself",
  "delete myself", "end it all", "final exit", "rope myself",
  "take the rope", "check out permanently", "log out of life",
  "permanent sleep", "sleep forever", "long sleep forever",
  "yeet myself", "step in front of traffic", "jump in front of train",
  "end game myself", "go offline forever",
]; // base weight: 6

const HOPELESSNESS_KEYWORDS = [
  "nothing matters", "nothing matters anymore", "life is pointless",
  "everything is pointless", "no reason to live", "there is no point",
  "there is no hope", "i feel hopeless", "i am hopeless",
  "nobody cares about me", "nobody would miss me",
  "everyone would be better without me", "i am a burden",
  "i am worthless", "i hate being alive", "life is meaningless",
  "i am completely broken", "i cannot take this anymore",
  "i want everything to stop", "i give up on life", "i feel empty inside",
  "nothing will ever change", "everything is ruined", "i am beyond help",
]; // base weight: 4

// ── Modifier lists ───────────────────────────────────────────────────────────

const FIRST_PERSON_REGEX = /\b(i|me|my|myself)\b/;

const URGENCY_WORDS = ["tonight", "today", "now", "immediately", "soon", "goodbye"];

// ── Notification messages (from YAML actions) ────────────────────────────────

const MEDIUM_MESSAGE =
  "It sounds like you're going through something difficult. Talking to someone you trust or a professional might really help.";

const HIGH_MESSAGE =
  "You may be experiencing serious emotional pain. It might help to reach out to a trained mental health professional or crisis support service.";

const CRITICAL_MESSAGE =
  "I'm really sorry you're feeling this way. You don't have to go through this alone.\n\nIf you may harm yourself, please contact a trained professional right now.\n\n• Call your local emergency number\n• Contact a suicide crisis hotline\n• Reach out to someone you trust nearby";

// ── Main detection function ──────────────────────────────────────────────────

export function detectSelfHarm(rawText: string): DetectionResult {
  const text = rawText.toLowerCase();

  // Step 1: Strip known figurative phrases so they don't score
  let scoringText = text;
  for (const phrase of FIGURATIVE_PHRASES) {
    scoringText = scoringText.split(phrase).join(" ");
  }

  // Step 2: If educational or media context is present, treat as safe
  const hasEducationalContext = EDUCATIONAL_CONTEXT_WORDS.some(word => scoringText.includes(word));
  const hasMediaContext = MEDIA_CONTEXT_WORDS.some(word => scoringText.includes(word));
  if (hasEducationalContext || hasMediaContext) {
    return { riskLevel: "none", message: "" };
  }

  // Step 3: Score each category
  let score = 0;
  if (DIRECT_SUICIDE_KEYWORDS.some(kw => scoringText.includes(kw))) score += 10;
  if (SUICIDE_PLANNING_KEYWORDS.some(kw => scoringText.includes(kw))) score += 9;
  if (SELF_HARM_KEYWORDS.some(kw => scoringText.includes(kw))) score += 8;
  if (SLANG_KEYWORDS.some(kw => scoringText.includes(kw))) score += 6;
  if (HOPELESSNESS_KEYWORDS.some(kw => scoringText.includes(kw))) score += 4;

  // Step 4: Apply modifiers
  if (FIRST_PERSON_REGEX.test(scoringText)) score += 2;
  if (URGENCY_WORDS.some(word => scoringText.includes(word))) score += 3;

  // Step 5: Map score to threshold level (from YAML thresholds)
  if (score <= 5) return { riskLevel: "none", message: "" };
  if (score <= 10) return { riskLevel: "medium", message: MEDIUM_MESSAGE };
  if (score <= 15) return { riskLevel: "high", message: HIGH_MESSAGE };
  return { riskLevel: "critical", message: CRITICAL_MESSAGE };
}
