import { getAgentHumanizerConfig } from "./config"; // função que lê do settings com TTL 5min
import {
  pickModeV2,
  buildBubblesFromModeTemplates,
  enforceBubbleRules,
  applyStageAndEmotionTweaks,
  emotionDelayMultiplier,
  buildMessagePlan,
} from "./humanizer";

import type { EmotionKey, IntentionKey, StageKey, MessagePlan } from "./types";

export async function humanizeAgentAnswer(params: {
  aiText: string;
  emotion: EmotionKey;
  intention: IntentionKey;
  stage: StageKey;
}): Promise<MessagePlan> {
  const { aiText, emotion, intention, stage } = params;

  const cfg = await getAgentHumanizerConfig(); 
  // cfg precisa ter:
  // - rules: { maxBubbles, maxSentencesPerBubble, maxEmojiPerBubble, defaultQuestion? }
  // - delay: { base, perChar, cap, anxiousMultiplier?, skepticalMultiplier?... }
  // - templates/modes (AgentModesConfig)

  const mode = pickModeV2(intention, emotion, stage);

  let bubbles = buildBubblesFromModeTemplates(mode, cfg.modes, aiText);

  bubbles = enforceBubbleRules(bubbles, {
    maxBubbles: cfg.rules.maxBubbles,
    maxSentencesPerBubble: cfg.rules.maxSentencesPerBubble,
    maxEmojiPerBubble: cfg.rules.maxEmojiPerBubble,
  });

  bubbles = applyStageAndEmotionTweaks(bubbles, stage, emotion);

  const multiplier = emotionDelayMultiplier(emotion, cfg.delay);

  return buildMessagePlan(
    bubbles,
    {
      mode,
      emotion,
      intention,
      stage,
    },
    cfg,
    multiplier
  );
}
