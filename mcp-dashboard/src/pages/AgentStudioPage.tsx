// src/pages/AgentStudioPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  RotateCcw,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  MessageSquareText,
  Clock,
} from "lucide-react";

/**
 * ============================
 * ✅ Tipos (monolito)
 * ============================
 */
type Intention =
  | "primeiro_contato"
  | "cliente_bravo"
  | "orcamento"
  | "agendamento"
  | "curiosidade"
  | "outros";

type Stage = "cold" | "warm" | "hot" | "unknown";

type Emotion =
  | "neutral"
  | "anxious"
  | "skeptical"
  | "frustrated"
  | "excited"
  | "price_sensitive"
  | "ready"
  | "curious";

type CTA = "soft" | "medium" | "hard";

type HumanizerStageBehavior = {
  maxBubbles: number;
  requireQuestion: boolean;
  ctaLevel: CTA;
};

type HumanizerConfig = {
  maxBubbles: number;
  maxSentencesPerBubble: number;
  maxEmojiPerBubble: number;

  delay: {
    base: number;
    perChar: number;
    cap: number;

    anxiousMultiplier: number;
    skepticalMultiplier: number;
    frustratedMultiplier: number;
    excitedMultiplier: number;

    // extras (opcional)
    priceSensitiveMultiplier?: number;
    readyMultiplier?: number;
    curiousMultiplier?: number;
  };

  stageBehavior: Record<"cold" | "warm" | "hot", HumanizerStageBehavior>;

  saveChunksToDB: boolean;
  saveTypingChunks: boolean;

  // Templates por intenção (2 bolhas)
  intentModes: Record<
    "primeiro_contato" | "cliente_bravo" | "orcamento",
    { templates: [string, string] }
  >;
};

type FullConfig = {
  humanizer: HumanizerConfig;
};

/**
 * ============================
 * ✅ Defaults (produto)
 * ============================
 */
const DEFAULT_CONFIG: FullConfig = {
  humanizer: {
    maxBubbles: 2,
    maxSentencesPerBubble: 2,
    maxEmojiPerBubble: 1,

    delay: {
      base: 450,
      perChar: 18,
      cap: 1750,
      anxiousMultiplier: 0.6,
      skepticalMultiplier: 1.15,
      frustratedMultiplier: 1.0,
      excitedMultiplier: 0.9,
      priceSensitiveMultiplier: 1.08,
      readyMultiplier: 0.92,
      curiousMultiplier: 1.0,
    },

    stageBehavior: {
      cold: { maxBubbles: 2, requireQuestion: true, ctaLevel: "soft" },
      warm: { maxBubbles: 2, requireQuestion: true, ctaLevel: "medium" },
      hot: { maxBubbles: 2, requireQuestion: true, ctaLevel: "hard" },
    },

    saveChunksToDB: true,
    saveTypingChunks: true,

    intentModes: {
      primeiro_contato: {
        templates: [
          "Oi! 👋 Prazer, sou o Douglas da DOCA.",
          "Me conta rapidinho: você tá buscando melhorar marketing, vendas ou operação?",
        ],
      },
      cliente_bravo: {
        templates: [
          "Poxa… entendi. Sinto muito por isso 🙏",
          "Me diz o que aconteceu (e o número/contato) que eu já resolvo pra você agora.",
        ],
      },
      orcamento: {
        templates: [
          "Consigo sim 😊 Só pra eu te passar certinho:",
          "é pra você ou pra equipe? E qual objetivo principal (mais leads, conversão ou atendimento)?",
        ],
      },
    },
  },
};

/**
 * ============================
 * ✅ Helpers (ui + engine)
 * ============================
 */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse<T>(val: any, fallback: T): T {
  try {
    if (!val) return fallback;
    if (typeof val === "string") return JSON.parse(val) as T;
    return val as T;
  } catch {
    return fallback;
  }
}

function normalizeWhitespace(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const t = normalizeWhitespace(text);
  if (!t) return [];
  const parts = t
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [t];
}

function stripTooManyEmojis(text: string, maxEmojis = 1): string {
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

function ensureQuestionAtEnd(text: string, fallbackQuestion: string): string {
  const t = (text || "").trim();
  if (!t) return fallbackQuestion;
  if (t.includes("?")) return t;
  return `${t}\n\n${fallbackQuestion}`;
}

function calcDelayMs(
  text: string,
  cfg: { base: number; perChar: number; cap: number },
  multiplier = 1
) {
  const t = (text || "").trim();
  if (!t) return Math.round(cfg.base * multiplier);
  const raw = cfg.base + t.length * cfg.perChar;
  const clamped = clamp(raw, cfg.base, cfg.cap);
  return Math.round(clamped * multiplier);
}

function emotionMultiplier(emotion: Emotion, delayCfg: HumanizerConfig["delay"]) {
  if (emotion === "anxious") return delayCfg.anxiousMultiplier ?? 0.6;
  if (emotion === "skeptical") return delayCfg.skepticalMultiplier ?? 1.15;
  if (emotion === "frustrated") return delayCfg.frustratedMultiplier ?? 1.0;
  if (emotion === "excited") return delayCfg.excitedMultiplier ?? 0.9;

  // extras
  if (emotion === "price_sensitive") return delayCfg.priceSensitiveMultiplier ?? 1.08;
  if (emotion === "ready") return delayCfg.readyMultiplier ?? 0.92;
  if (emotion === "curious") return delayCfg.curiousMultiplier ?? 1.0;

  return 1;
}

function getStageBehavior(cfg: HumanizerConfig, stage: Stage): HumanizerStageBehavior {
  if (stage === "cold") return cfg.stageBehavior.cold;
  if (stage === "warm") return cfg.stageBehavior.warm;
  if (stage === "hot") return cfg.stageBehavior.hot;
  // unknown: usa warm como padrão (pra não ficar “morto”)
  return cfg.stageBehavior.warm;
}

function pickQuestionByCTA(cta: CTA): string {
  if (cta === "hard") return "Bora marcar 15 min pra eu te mostrar o caminho? Hoje ou amanhã?";
  if (cta === "medium") return "Quer que eu te mostre um exemplo real e a gente decide juntos?";
  return "Me conta rapidinho seu cenário?";
}

function applyGeneralBubbleRules(cfg: HumanizerConfig, bubbles: string[]) {
  let b = (bubbles || []).map(normalizeWhitespace).filter(Boolean);

  // regras de frases/emoji por bolha
  b = b.map((bubble) => {
    const s = splitIntoSentences(bubble);
    const short = s.slice(0, cfg.maxSentencesPerBubble).join(" ");
    return stripTooManyEmojis(short, cfg.maxEmojiPerBubble);
  });

  return b;
}

/**
 * ✅ Engine principal:
 * - Usa templates se intenção for uma das “hard-coded”
 * - Senão transforma aiText em bolhas
 * - Aplica stageBehavior (maxBubbles/requireQuestion/ctaLevel)
 * - Aplica tweaks por emoção/stage
 */
function buildBubbles(
  cfg: HumanizerConfig,
  intention: Intention,
  aiText: string,
  stage: Stage,
  emotion: Emotion
): string[] {
  const sb = getStageBehavior(cfg, stage);

  // 1) templates por intenção
  if (intention === "primeiro_contato") return applyGeneralBubbleRules(cfg, cfg.intentModes.primeiro_contato.templates.slice(0, sb.maxBubbles));
  if (intention === "cliente_bravo") return applyGeneralBubbleRules(cfg, cfg.intentModes.cliente_bravo.templates.slice(0, sb.maxBubbles));
  if (intention === "orcamento") return applyGeneralBubbleRules(cfg, cfg.intentModes.orcamento.templates.slice(0, sb.maxBubbles));

  // 2) gerar a partir do texto
  const cleaned = normalizeWhitespace(aiText);
  const sentences = splitIntoSentences(cleaned);

  let bubbles: string[] = [];

  // Se intenção / emoção pede resposta mais curta
  const forceSingle =
    emotion === "anxious" ||
    intention === "agendamento" ||
    emotion === "ready";

  if (forceSingle) {
    const one = sentences.slice(0, 2).join(" ");
    bubbles = [one || "Perfeito! Me conta rapidinho: qual seu objetivo hoje? 😊"];
  } else {
    const first = sentences.slice(0, 2).join(" ");
    const rest = sentences.slice(2).join(" ").trim();

    bubbles = [
      first || "Perfeito! 😊",
      rest || "Me conta um pouco do seu cenário?",
    ];
  }

  bubbles = applyGeneralBubbleRules(cfg, bubbles);

  // 3) stage max bubbles
  if (bubbles.length > sb.maxBubbles) bubbles = bubbles.slice(0, sb.maxBubbles);

  // 4) tweaks por emoção/stage
  const lastIdx = bubbles.length - 1;

  if (emotion === "skeptical") {
    bubbles[0] = `${bubbles[0]}\n\nSem promessas mágicas — eu te mostro exemplo real antes.`;
    bubbles[lastIdx] = ensureQuestionAtEnd(
      bubbles[lastIdx],
      "Quer que eu te mande um exemplo rápido?"
    );
  }

  if (emotion === "anxious") {
    bubbles[lastIdx] = ensureQuestionAtEnd(
      bubbles[lastIdx].replace(/\n+/g, " ").trim(),
      "Me diz em 1 frase o que você precisa agora?"
    );
  }

  if (emotion === "price_sensitive") {
    bubbles[0] = `${bubbles[0]}\n\nA gente consegue ajustar pro seu orçamento — sem enrolação.`;
    bubbles[lastIdx] = ensureQuestionAtEnd(
      bubbles[lastIdx],
      "Qual faixa de investimento você tem em mente hoje?"
    );
  }

  if (emotion === "curious") {
    bubbles[lastIdx] = ensureQuestionAtEnd(
      bubbles[lastIdx],
      "Quer que eu te explique em 30s como funciona por dentro?"
    );
  }

  // stage hot sempre tende a CTA
  if (stage === "hot") {
    bubbles[lastIdx] = ensureQuestionAtEnd(
      bubbles[lastIdx],
      pickQuestionByCTA("hard")
    );
  }

  // 5) requireQuestion + ctaLevel (AGORA FUNCIONA ✅)
  if (sb.requireQuestion) {
    const hasQuestion = bubbles.some((b) => b.includes("?"));
    if (!hasQuestion) {
      bubbles[lastIdx] = ensureQuestionAtEnd(
        bubbles[lastIdx],
        pickQuestionByCTA(sb.ctaLevel)
      );
    }
  }

  return bubbles;
}

/**
 * ============================
 * ✅ Página
 * ============================
 */
export default function AgentStudioPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<FullConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Preview controls
  const [previewIntention, setPreviewIntention] =
    useState<Intention>("primeiro_contato");
  const [previewStage, setPreviewStage] = useState<Stage>("cold");
  const [previewEmotion, setPreviewEmotion] = useState<Emotion>("neutral");
  const [previewAIText, setPreviewAIText] = useState(
    "Show! A DOCA ajuda negócios a automatizar atendimento, gerar leads e treinar equipes. Se você me disser seu objetivo, eu te guio no melhor caminho."
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewBubbles, setPreviewBubbles] = useState<string[]>([]);
  const [currentBubbleIndex, setCurrentBubbleIndex] = useState(-1);
  const [typing, setTyping] = useState(false);

  const timerRef = useRef<number | null>(null);

  // ✅ base vazio: roda bem atrás do nginx/traefik
  const apiBase = useMemo(() => "", []);

  async function loadConfig() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${apiBase}/api/settings?key=agent_humanizer_config`
      );

      if (res.status === 404) {
        setConfig(DEFAULT_CONFIG);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao carregar setting");
      }

      const data = await res.json();
      const parsed = safeJsonParse<FullConfig>(data?.value, DEFAULT_CONFIG);

      // ✅ Merge defensivo (nunca quebra)
      const merged: FullConfig = {
        humanizer: {
          ...DEFAULT_CONFIG.humanizer,
          ...(parsed?.humanizer || {}),
          delay: {
            ...DEFAULT_CONFIG.humanizer.delay,
            ...(parsed?.humanizer?.delay || {}),
          },
          stageBehavior: {
            cold: {
              ...DEFAULT_CONFIG.humanizer.stageBehavior.cold,
              ...(parsed?.humanizer?.stageBehavior?.cold || {}),
            },
            warm: {
              ...DEFAULT_CONFIG.humanizer.stageBehavior.warm,
              ...(parsed?.humanizer?.stageBehavior?.warm || {}),
            },
            hot: {
              ...DEFAULT_CONFIG.humanizer.stageBehavior.hot,
              ...(parsed?.humanizer?.stageBehavior?.hot || {}),
            },
          },
          intentModes: {
            primeiro_contato: {
              templates:
                (parsed?.humanizer?.intentModes?.primeiro_contato?.templates as any) ||
                DEFAULT_CONFIG.humanizer.intentModes.primeiro_contato.templates,
            },
            cliente_bravo: {
              templates:
                (parsed?.humanizer?.intentModes?.cliente_bravo?.templates as any) ||
                DEFAULT_CONFIG.humanizer.intentModes.cliente_bravo.templates,
            },
            orcamento: {
              templates:
                (parsed?.humanizer?.intentModes?.orcamento?.templates as any) ||
                DEFAULT_CONFIG.humanizer.intentModes.orcamento.templates,
            },
          },
        },
      };

      setConfig(merged);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar config");
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
    }
  }

  async function saveConfig() {
    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`${apiBase}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "agent_humanizer_config",
          value: JSON.stringify(config),
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao salvar setting");
      }

      setLastSavedAt(new Date());
      setSaving(false);
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar config");
      setSaving(false);
    }
  }

  function resetToDefault() {
    setConfig(DEFAULT_CONFIG);
  }

  function stopPreview() {
    setIsPlaying(false);
    setTyping(false);
    setCurrentBubbleIndex(-1);
    setPreviewBubbles([]);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startPreview() {
    stopPreview();
    setIsPlaying(true);

    const bubbles = buildBubbles(
      config.humanizer,
      previewIntention,
      previewAIText,
      previewStage,
      previewEmotion
    );

    setPreviewBubbles(bubbles);
    setCurrentBubbleIndex(-1);

    const mult = emotionMultiplier(previewEmotion, config.humanizer.delay);

    let idx = -1;
    const runNext = () => {
      idx++;

      if (idx >= bubbles.length) {
        setTyping(false);
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }

      setTyping(true);

      timerRef.current = window.setTimeout(() => {
        setTyping(false);
        setCurrentBubbleIndex(idx);

        const delay = calcDelayMs(bubbles[idx], config.humanizer.delay, mult);

        timerRef.current = window.setTimeout(() => {
          runNext();
        }, delay);
      }, idx === 0 ? 250 : 350);
    };

    runNext();
  }

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin text-[#f57f17]" />
          <span className="font-semibold">Carregando Agent Studio…</span>
        </div>
      </div>
    );
  }

  const hz = config.humanizer;

  const previewTotalDelay = previewBubbles.reduce(
    (acc, b) =>
      acc + calcDelayMs(b, hz.delay, emotionMultiplier(previewEmotion, hz.delay)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 bg-white/5">
            <Sparkles className="w-4 h-4 text-[#f57f17]" />
            <span className="text-sm font-semibold text-white">Agent Studio</span>
            <span className="text-xs text-gray-500">
              Controle total: bolhas, delays, stage e templates
            </span>
          </div>

          <p className="text-gray-500 text-sm mt-3 max-w-3xl">
            Essa aba controla a “humanização” do atendimento: quantidade de bolhas,
            velocidade de digitação, ajustes por emoção/stage e templates por intenção.
            Tudo salva em <b>agent_humanizer_config</b> e pode ser usado pelo agente em runtime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
          >
            <RotateCcw className="w-4 h-4 text-gray-300" />
            Reset
          </button>

          <button
            onClick={saveConfig}
            disabled={saving}
            className={cn(
              "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
              saving
                ? "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                : "border-[#f57f17]/35 bg-[#f57f17]/10 text-white hover:bg-[#f57f17]/15 shadow-[0_0_0_1px_rgba(245,127,23,0.14)]"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#f57f17]" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#f57f17]" />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {lastSavedAt && (
        <div className="text-xs text-gray-500">
          Último save:{" "}
          <span className="text-gray-300 font-semibold">
            {lastSavedAt.toLocaleString("pt-BR")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-6">
          {/* Core */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <SlidersHorizontal className="w-4 h-4 text-[#f57f17]" />
              <h3 className="text-lg font-bold text-white">Humanizer</h3>
              <span className="text-xs text-gray-500">regras gerais</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ControlSlider
                label="Max bolhas (global)"
                value={hz.maxBubbles}
                min={1}
                max={4}
                step={1}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: { ...prev.humanizer, maxBubbles: v },
                  }))
                }
              />
              <ControlSlider
                label="Sentenças/bolha"
                value={hz.maxSentencesPerBubble}
                min={1}
                max={3}
                step={1}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: { ...prev.humanizer, maxSentencesPerBubble: v },
                  }))
                }
              />
              <ControlSlider
                label="Emoji/bolha"
                value={hz.maxEmojiPerBubble}
                min={0}
                max={2}
                step={1}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: { ...prev.humanizer, maxEmojiPerBubble: v },
                  }))
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Toggle
                label="Salvar chunks no DB"
                value={hz.saveChunksToDB}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: { ...prev.humanizer, saveChunksToDB: v },
                  }))
                }
              />
              <Toggle
                label="Salvar typing chunks"
                value={hz.saveTypingChunks}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: { ...prev.humanizer, saveTypingChunks: v },
                  }))
                }
              />
            </div>
          </section>

          {/* Delay */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-[#f57f17]" />
              <h3 className="text-lg font-bold text-white">Typing/Delay</h3>
              <span className="text-xs text-gray-500">velocidade e ritmo</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ControlSlider
                label="Base (ms)"
                value={hz.delay.base}
                min={150}
                max={1200}
                step={10}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: { ...prev.humanizer.delay, base: v },
                    },
                  }))
                }
              />
              <ControlSlider
                label="Per char (ms)"
                value={hz.delay.perChar}
                min={5}
                max={40}
                step={1}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: { ...prev.humanizer.delay, perChar: v },
                    },
                  }))
                }
              />
              <ControlSlider
                label="Cap (ms)"
                value={hz.delay.cap}
                min={600}
                max={4500}
                step={50}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: { ...prev.humanizer.delay, cap: v },
                    },
                  }))
                }
              />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ControlSlider
                label="Ansioso (x)"
                value={hz.delay.anxiousMultiplier}
                min={0.3}
                max={1.2}
                step={0.05}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: {
                        ...prev.humanizer.delay,
                        anxiousMultiplier: v,
                      },
                    },
                  }))
                }
              />
              <ControlSlider
                label="Cético (x)"
                value={hz.delay.skepticalMultiplier}
                min={0.8}
                max={1.6}
                step={0.05}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: {
                        ...prev.humanizer.delay,
                        skepticalMultiplier: v,
                      },
                    },
                  }))
                }
              />
              <ControlSlider
                label="Frustrado (x)"
                value={hz.delay.frustratedMultiplier}
                min={0.6}
                max={1.4}
                step={0.05}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: {
                        ...prev.humanizer.delay,
                        frustratedMultiplier: v,
                      },
                    },
                  }))
                }
              />
              <ControlSlider
                label="Empolgado (x)"
                value={hz.delay.excitedMultiplier}
                min={0.6}
                max={1.3}
                step={0.05}
                onChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    humanizer: {
                      ...prev.humanizer,
                      delay: {
                        ...prev.humanizer.delay,
                        excitedMultiplier: v,
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Extras (opcional)</div>
              <p className="text-xs text-gray-500 mt-1">
                Se o backend mandar emoções extras, já está suportado.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <ControlSlider
                  label="Preço sensível (x)"
                  value={hz.delay.priceSensitiveMultiplier ?? 1.08}
                  min={0.8}
                  max={1.4}
                  step={0.05}
                  onChange={(v) =>
                    setConfig((prev) => ({
                      ...prev,
                      humanizer: {
                        ...prev.humanizer,
                        delay: {
                          ...prev.humanizer.delay,
                          priceSensitiveMultiplier: v,
                        },
                      },
                    }))
                  }
                />
                <ControlSlider
                  label="Ready (x)"
                  value={hz.delay.readyMultiplier ?? 0.92}
                  min={0.6}
                  max={1.2}
                  step={0.05}
                  onChange={(v) =>
                    setConfig((prev) => ({
                      ...prev,
                      humanizer: {
                        ...prev.humanizer,
                        delay: { ...prev.humanizer.delay, readyMultiplier: v },
                      },
                    }))
                  }
                />
                <ControlSlider
                  label="Curioso (x)"
                  value={hz.delay.curiousMultiplier ?? 1.0}
                  min={0.6}
                  max={1.3}
                  step={0.05}
                  onChange={(v) =>
                    setConfig((prev) => ({
                      ...prev,
                      humanizer: {
                        ...prev.humanizer,
                        delay: {
                          ...prev.humanizer.delay,
                          curiousMultiplier: v,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
          </section>

          {/* Stage */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <MessageSquareText className="w-4 h-4 text-[#f57f17]" />
              <h3 className="text-lg font-bold text-white">Stage Behavior</h3>
              <span className="text-xs text-gray-500">cold / warm / hot</span>
            </div>

            <StageRow
              title="Cold"
              data={hz.stageBehavior.cold}
              onChange={(next) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    stageBehavior: {
                      ...prev.humanizer.stageBehavior,
                      cold: next,
                    },
                  },
                }))
              }
            />
            <div className="h-3" />
            <StageRow
              title="Warm"
              data={hz.stageBehavior.warm}
              onChange={(next) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    stageBehavior: {
                      ...prev.humanizer.stageBehavior,
                      warm: next,
                    },
                  },
                }))
              }
            />
            <div className="h-3" />
            <StageRow
              title="Hot"
              data={hz.stageBehavior.hot}
              onChange={(next) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    stageBehavior: {
                      ...prev.humanizer.stageBehavior,
                      hot: next,
                    },
                  },
                }))
              }
            />
          </section>

          {/* Templates */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f57f17]" />
                <h3 className="text-lg font-bold text-white">
                  Templates por Intenção
                </h3>
              </div>
              <span className="text-xs text-gray-500">duas bolhas por intenção</span>
            </div>

            <TemplateEditor
              title="Primeiro contato"
              value={hz.intentModes.primeiro_contato.templates}
              onChange={(t) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    intentModes: {
                      ...prev.humanizer.intentModes,
                      primeiro_contato: { templates: t },
                    },
                  },
                }))
              }
            />
            <div className="h-4" />
            <TemplateEditor
              title="Cliente bravo"
              value={hz.intentModes.cliente_bravo.templates}
              onChange={(t) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    intentModes: {
                      ...prev.humanizer.intentModes,
                      cliente_bravo: { templates: t },
                    },
                  },
                }))
              }
            />
            <div className="h-4" />
            <TemplateEditor
              title="Orçamento"
              value={hz.intentModes.orcamento.templates}
              onChange={(t) =>
                setConfig((prev) => ({
                  ...prev,
                  humanizer: {
                    ...prev.humanizer,
                    intentModes: {
                      ...prev.humanizer.intentModes,
                      orcamento: { templates: t },
                    },
                  },
                }))
              }
            />
          </section>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f57f17]" />
                <h3 className="text-lg font-bold text-white">Preview WhatsApp</h3>
                <span className="text-xs text-gray-500">simulação local</span>
              </div>

              <button
                onClick={() => (isPlaying ? stopPreview() : startPreview())}
                className={cn(
                  "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                  isPlaying
                    ? "border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                    : "border-[#f57f17]/35 bg-[#f57f17]/10 text-white hover:bg-[#f57f17]/15"
                )}
              >
                {isPlaying ? "Parar" : "Reproduzir"}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="Intenção"
                value={previewIntention}
                options={[
                  { value: "primeiro_contato", label: "Primeiro contato" },
                  { value: "cliente_bravo", label: "Cliente bravo" },
                  { value: "orcamento", label: "Orçamento" },
                  { value: "agendamento", label: "Agendamento" },
                  { value: "curiosidade", label: "Curiosidade" },
                  { value: "outros", label: "Outros" },
                ]}
                onChange={(v) => setPreviewIntention(v as any)}
              />
              <Select
                label="Stage"
                value={previewStage}
                options={[
                  { value: "cold", label: "Cold" },
                  { value: "warm", label: "Warm" },
                  { value: "hot", label: "Hot" },
                  { value: "unknown", label: "Unknown" },
                ]}
                onChange={(v) => setPreviewStage(v as any)}
              />
              <Select
                label="Emoção"
                value={previewEmotion}
                options={[
                  { value: "neutral", label: "Neutral" },
                  { value: "anxious", label: "Ansioso" },
                  { value: "skeptical", label: "Cético" },
                  { value: "frustrated", label: "Frustrado" },
                  { value: "excited", label: "Empolgado" },
                  { value: "price_sensitive", label: "Preço sensível" },
                  { value: "ready", label: "Pronto (ready)" },
                  { value: "curious", label: "Curioso" },
                ]}
                onChange={(v) => setPreviewEmotion(v as any)}
              />
            </div>

            <div className="mt-4">
              <label className="text-xs text-gray-500 font-semibold">
                Texto base (matéria-prima)
              </label>
              <textarea
                value={previewAIText}
                onChange={(e) => setPreviewAIText(e.target.value)}
                className="mt-2 w-full min-h-[110px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </div>

            {/* Phone mock */}
            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/35 p-4">
              <div className="mx-auto max-w-[420px] rounded-[28px] border border-white/10 bg-black overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 bg-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                      <span className="text-[#f57f17] font-bold text-sm">D</span>
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-white">Douglas</p>
                      <p className="text-xs text-gray-500">
                        {typing ? "digitando…" : "online"}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">{typing ? "…" : "✔✔"}</div>
                </div>

                <div className="p-4 space-y-3 min-h-[360px] bg-gradient-to-b from-black to-black/70">
                  {/* user */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-emerald-500/15 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-50">
                      Oi! Quero entender como vocês podem me ajudar.
                    </div>
                  </div>

                  {/* assistant bubbles */}
                  {previewBubbles.map((b, i) => {
                    const visible = i <= currentBubbleIndex;
                    if (!visible) return null;

                    return (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-sm text-gray-100 whitespace-pre-line">
                          {b}
                        </div>
                      </div>
                    );
                  })}

                  {/* typing bubble */}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="max-w-[65%] rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-sm text-gray-300">
                        <span className="inline-flex gap-1">
                          <span className="animate-pulse">•</span>
                          <span className="animate-pulse [animation-delay:120ms]">
                            •
                          </span>
                          <span className="animate-pulse [animation-delay:240ms]">
                            •
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 bg-white/[0.03] flex items-center gap-3">
                  <input
                    disabled
                    value="Digite uma mensagem…"
                    className="flex-1 h-10 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm text-gray-500"
                  />
                  <button
                    disabled
                    className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"
                    title="Enviar"
                  >
                    <Sparkles className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold text-gray-300">Bolhas geradas</div>
                  <div className="mt-1">{previewBubbles.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold text-gray-300">Delay (estimado)</div>
                  <div className="mt-1">{previewTotalDelay}ms</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-bold text-white">Dica de produto</h3>
            <p className="text-sm text-gray-500 mt-2">
              Depois a gente liga um endpoint “recarregar cache do agente” (TTL 5min)
              pra aplicar config em runtime sem restart.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================
 * ✅ UI components (internos)
 * ============================
 */
function ControlSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step, onChange } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-gray-400 font-semibold">{value}</div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#f57f17]"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { label, value, onChange } = props;

  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "px-4 py-2 rounded-2xl border text-sm font-semibold transition-all",
        value
          ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white"
          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
      )}
    >
      {label}: <span className="text-[#f57f17]">{value ? "ON" : "OFF"}</span>
    </button>
  );
}

function StageRow(props: {
  title: string;
  data: { maxBubbles: number; requireQuestion: boolean; ctaLevel: CTA };
  onChange: (next: { maxBubbles: number; requireQuestion: boolean; ctaLevel: CTA }) => void;
}) {
  const { title, data, onChange } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white">{title}</div>
        <div className="text-xs text-gray-500">config do stage</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <ControlSlider
          label="Max bolhas"
          value={data.maxBubbles}
          min={1}
          max={4}
          step={1}
          onChange={(v) => onChange({ ...data, maxBubbles: v })}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-semibold text-white">Require question</div>
          <p className="text-xs text-gray-500 mt-1">se ON, força pergunta no final</p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onChange({ ...data, requireQuestion: true })}
              className={cn(
                "h-9 px-3 rounded-2xl border text-sm font-semibold",
                data.requireQuestion
                  ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
              )}
            >
              ON
            </button>
            <button
              onClick={() => onChange({ ...data, requireQuestion: false })}
              className={cn(
                "h-9 px-3 rounded-2xl border text-sm font-semibold",
                !data.requireQuestion
                  ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white"
                  : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
              )}
            >
              OFF
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-semibold text-white">CTA Level</div>
          <p className="text-xs text-gray-500 mt-1">intensidade do CTA final</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["soft", "medium", "hard"] as CTA[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => onChange({ ...data, ctaLevel: lvl })}
                className={cn(
                  "h-9 px-3 rounded-2xl border text-sm font-semibold capitalize",
                  data.ctaLevel === lvl
                    ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white"
                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                )}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor(props: {
  title: string;
  value: [string, string];
  onChange: (v: [string, string]) => void;
}) {
  const { title, value, onChange } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-white">{title}</div>
        <span className="text-xs text-gray-500">2 bolhas</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-semibold">Bolha 1</label>
          <textarea
            value={value[0]}
            onChange={(e) => onChange([e.target.value, value[1]])}
            className="mt-2 w-full min-h-[78px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold">Bolha 2</label>
          <textarea
            value={value[1]}
            onChange={(e) => onChange([value[0], e.target.value])}
            className="mt-2 w-full min-h-[78px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function Select(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-gray-500 font-semibold">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full h-10 rounded-2xl bg-white/5 border border-white/10 px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
