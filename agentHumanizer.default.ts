export const DEFAULT_HUMANIZER_CONFIG = {
  version: 1,
  humanizer: {
    maxBubbles: 2,
    maxSentencesPerBubble: 2,
    maxEmojiPerBubble: 1,

    delay: {
      base: 450,
      perChar: 18,
      cap: 1750,
      multipliers: {
        anxious: 0.6,
        skeptical: 1.15,
        frustrated: 1.0,
        excited: 0.9,
        neutral: 1.0,
      }
    },

    saveChunksToDB: true,
    saveTypingChunks: true,
  },

  stageRules: {
    cold: { maxBubbles: 2, requireQuestion: true },
    warm: { maxBubbles: 2, requireQuestion: true },
    hot: { maxBubbles: 1, requireQuestion: true }
  },

  intentModes: {
    primeiro_contato: {
      bubbles: 2,
      templates: [
        "Oi! 👋 Prazer, sou o Douglas da DOCA.",
        "Me conta rapidinho: você tá buscando melhorar marketing, vendas ou operação?"
      ]
    },
    cliente_bravo: {
      bubbles: 2,
      templates: [
        "Poxa… entendi. Sinto muito por isso 🙏",
        "Me diz o que aconteceu (e o número/contato) que eu já resolvo pra você agora."
      ]
    },
    orcamento: {
      bubbles: 2,
      templates: [
        "Consigo sim 😊 Só pra eu te passar certinho:",
        "é pra você ou pra equipe? E qual objetivo principal (mais leads, conversão ou atendimento)?"
      ]
    },
  },

  emotionTweaks: {
    skeptical: { addSocialProof: true, safeTone: true },
    anxious: { beDirect: true, reduceBubbles: true },
    frustrated: { validateFirst: true },
  }
};
