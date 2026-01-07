import type { HumanizerConfig } from "./types";
import { getSettingServerValue } from "@/lib/api/settings.server";

const KEY = "agent_humanizer_config";
const TTL_MS = 5 * 60 * 1000;

let cache: { value: HumanizerConfig; expiresAt: number } | null = null;
let inFlight: Promise<HumanizerConfig> | null = null;

const DEFAULTS: HumanizerConfig = {
  rules: {
    maxBubbles: 2,
    maxSentencesPerBubble: 2,
    maxEmojiPerBubble: 1,
    defaultQuestion: "Qual é sua meta principal hoje?",
  },
  delay: {
    base: 450,
    perChar: 12,
    cap: 2000,
    anxiousMultiplier: 0.6,
    skepticalMultiplier: 1.15,
    frustratedMultiplier: 1.0,
    excitedMultiplier: 0.9,
  },
  modes: {
    templates: {},
    rules: {
      defaultQuestion: "Qual é sua meta principal hoje?",
    },
  },
};

function mergeDefaults(parsed: any): HumanizerConfig {
  return {
    ...DEFAULTS,
    ...(parsed ?? {}),
    rules: { ...DEFAULTS.rules, ...(parsed?.rules ?? {}) },
    delay: { ...DEFAULTS.delay, ...(parsed?.delay ?? {}) },
    modes: { ...DEFAULTS.modes, ...(parsed?.modes ?? {}) },
  };
}

export async function getHumanizerConfig(): Promise<HumanizerConfig> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const jsonString = await getSettingServerValue(KEY);

      if (!jsonString) {
        cache = { value: DEFAULTS, expiresAt: now + TTL_MS };
        return cache.value;
      }

      try {
        const parsed = JSON.parse(jsonString);
        const value = mergeDefaults(parsed);
        cache = { value, expiresAt: now + TTL_MS };
        return value;
      } catch {
        cache = { value: DEFAULTS, expiresAt: now + TTL_MS };
        return cache.value;
      }
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function clearHumanizerConfigCache() {
  cache = null;
}
