import type {
  EmotionKey,
  IntentionKey,
  MessagePlan,
  MessagePlanItem,
  ResponseMode,
  StageKey,
  HumanizerConfig,
  AgentModesConfig,
} from "@/lib/agent/humanizer/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeWhitespace(text: string) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function splitIntoSentences(text: string) {
  const t = normalizeWhitespace(text);
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

export function stripTooManyEmojis(text: string, maxEmojis = 1) {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const matches = text.match(emojiRegex) || [];
  if (matches.length <= maxEmojis) return text;

  let removeCount = matches.length - maxEmojis;
  return text
    .replace(emojiRegex, (m) => {
      if (removeCount <= 0) return m;
      removeCount--;
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function ensureQuestionAtEnd(text: string, fallbackQuestion: string) {
  const t = (text || "").trim();
  if (!t) return fallbackQuestion;
  if (t.includes("?")) return t;
  return `${t}\n\n${fallbackQuestion}`;
}

export function normalizeStage(stage: string): StageKey {
  const s = String(stage || "").toLowerCase();
  if (s.includes("cold")) return "cold";
  if (s.includes("warm")) return "warm";
  if (s.includes("hot")) return "hot";
  return "unknown";
}

export function emotionDelayMultiplier(emotion: EmotionKey, cfg: HumanizerConfig["delay"]) {
  if (emotion === "anxious") return cfg?.anxiousMultiplier ?? 0.6;
  if (emotion === "skeptical") return cfg?.skepticalMultiplier ?? 1.15;
  if (emotion === "frustrated") return cfg?.frustratedMultiplier ?? 1.0;
  if (emotion === "excited") return cfg?.excitedMultiplier ?? 0.9;
  return 1.0;
}

export function calcDelayMs(
  text: string,
  cfg: { base: number; perChar: number; cap: number },
  multiplier = 1.0
) {
  const t = (text || "").trim();
  if (!t) return Math.round(cfg.base * multiplier);

  const raw = cfg.base + t.length * cfg.perChar;
  const clamped = clamp(raw, cfg.base, cfg.cap);
  return Math.round(clamped * multiplier);
}

export function pickModeV2(intention: IntentionKey, emotion: EmotionKey, stage: StageKey): ResponseMode {
  const st = normalizeStage(stage);
  const e = String(emotion || "").toLowerCase();

  if (intention === "primeiro_contato") return "FIRST_CONTACT";
  if (intention === "cliente_bravo") return "BRAVO";
  if (intention === "orcamento") return "BUDGET";

  if (st === "hot") return "HOT_CTA";
  if (e === "skeptical") return "SKEPTICAL";
  if (e === "anxious" || intention === "agendamento") return "SINGLE";

  return "TWO_BUBBLES";
}

export function enforceBubbleRules(
  bubbles: string[],
  cfg: { maxBubbles: number; maxSentencesPerBubble: number; maxEmojiPerBubble: number }
) {
  let b = (bubbles || []).map(normalizeWhitespace).filter(Boolean);

  if (b.length > cfg.maxBubbles) b = b.slice(0, cfg.maxBubbles);

  b = b.map((bubble) => {
    const sentences = splitIntoSentences(bubble);
    const short = sentences.slice(0, cfg.maxSentencesPerBubble).join(" ");
    return stripTooManyEmojis(short, cfg.maxEmojiPerBubble);
  });

  return b;
}

export function applyStageAndEmotionTweaks(bubbles: string[], stage: StageKey, emotion: EmotionKey) {
  const st = normalizeStage(stage);
  const e = String(emotion || "").toLowerCase();
  const b = [...bubbles];

  if (e === "anxious") {
    const last = b[b.length - 1] || "";
    b[b.length - 1] = ensureQuestionAtEnd(last.replace(/\n+/g, " ").trim(), "Me diz em 1 frase o que você precisa agora?");
  }

  if (e === "skeptical") {
    if (b[0]) b[0] = `${b[0]}\n\nSem promessas mágicas — eu te mostro exemplo real antes.`;
    const last = b[b.length - 1] || "";
    b[b.length - 1] = ensureQuestionAtEnd(last, "Quer que eu te mande um exemplo rápido?");
  }

  if (st === "hot") {
    const last = b[b.length - 1] || "";
    b[b.length - 1] = ensureQuestionAtEnd(last, "Bora marcar 15 min pra eu te mostrar o caminho? Hoje ou amanhã?");
  }

  if (st === "cold") {
    const last = b[b.length - 1] || "";
    b[b.length - 1] = ensureQuestionAtEnd(last, "Me conta rapidinho seu cenário?");
  }

  return b;
}

export function buildBubblesFromModeTemplates(mode: ResponseMode, modes: AgentModesConfig, aiText: string) {
  const t = modes?.templates?.[mode] || null;
  if (t && Array.isArray(t) && t.length) return t;

  const cleaned = normalizeWhitespace(aiText);
  if (!cleaned) return ["Perfeito! Me conta rapidinho: qual seu objetivo hoje? 😊"];
  const sentences = splitIntoSentences(cleaned);

  if (mode === "SINGLE") {
    const one = sentences.slice(0, 2).join(" ");
    return [stripTooManyEmojis(one, 1)];
  }

  const first = sentences.slice(0, 2).join(" ");
  const rest = sentences.slice(2).join(" ").trim();
  let b1 = stripTooManyEmojis(first, 1);
  let b2 = stripTooManyEmojis(rest || "", 1);

  if (!b2) b2 = "Me conta um pouco do seu cenário?";
  b2 = ensureQuestionAtEnd(b2, modes?.rules?.defaultQuestion || "Qual é sua meta principal hoje?");

  return [b1, b2].filter(Boolean);
}

export function buildMessagePlan(
  bubbles: string[],
  meta: MessagePlan["meta"],
  humanizer: HumanizerConfig,
  multiplier: number
): MessagePlan {
  const items: MessagePlanItem[] = [];

  for (let i = 0; i < bubbles.length; i++) {
    const text = bubbles[i];
    const delayMs = calcDelayMs(text, humanizer.delay, multiplier);

    items.push({ type: "typing", action: "start", delayMs: i === 0 ? 0 : 250 });
    items.push({ type: "text", text, delayMs });
    items.push({ type: "typing", action: "stop", delayMs: 0 });
  }

  return { items, bubbles, meta };
}
