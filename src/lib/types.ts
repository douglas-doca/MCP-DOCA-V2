// src/lib/agent/humanizer/types.ts

export type StageKey = "cold" | "warm" | "hot" | "unknown";

/**
 * Emoções usadas pelo humanizer.
 * Pode crescer depois, mas já cobre o que o arquivo usa.
 */
export type EmotionKey =
  | "neutral"
  | "anxious"
  | "skeptical"
  | "frustrated"
  | "excited"
  | (string & {});

/**
 * Intenções usadas no pickModeV2.
 * Você pode tipar melhor depois, mas assim não quebra.
 */
export type IntentionKey =
  | "primeiro_contato"
  | "cliente_bravo"
  | "orcamento"
  | "agendamento"
  | (string & {});

/**
 * Modos de resposta previstos no pickModeV2 + templates.
 */
export type ResponseMode =
  | "FIRST_CONTACT"
  | "BRAVO"
  | "BUDGET"
  | "HOT_CTA"
  | "SKEPTICAL"
  | "SINGLE"
  | "TWO_BUBBLES"
  | (string & {});

export type MessagePlanItem =
  | {
      type: "typing";
      action: "start" | "stop";
      delayMs: number;
    }
  | {
      type: "text";
      text: string;
      delayMs: number;
    };

export type MessagePlan = {
  items: MessagePlanItem[];
  bubbles: string[];
  meta: {
    mode: ResponseMode;
    emotion: EmotionKey;
    intention: IntentionKey;
    stage: StageKey;
    [k: string]: unknown;
  };
};

/**
 * Regras do humanizer (aplicadas depois que as bolhas são geradas).
 */
export type HumanizerRules = {
  maxBubbles: number;
  maxSentencesPerBubble: number;
  maxEmojiPerBubble: number;
  defaultQuestion?: string;
};

/**
 * Config de delay de digitação / envio.
 */
export type HumanizerDelayConfig = {
  base: number; // ms base
  perChar: number; // ms por caractere
  cap: number; // teto de ms
  anxiousMultiplier?: number;
  skepticalMultiplier?: number;
  frustratedMultiplier?: number;
  excitedMultiplier?: number;
};

/**
 * Templates por modo, e regras gerais por modo.
 */
export type AgentModesConfig = {
  templates?: Partial<Record<ResponseMode, string[]>>;
  rules?: {
    defaultQuestion?: string;
  };
};

/**
 * Config principal usada no buildMessagePlan.
 */
export type HumanizerConfig = {
  rules: HumanizerRules;
  delay: HumanizerDelayConfig;
  modes: AgentModesConfig;
};
