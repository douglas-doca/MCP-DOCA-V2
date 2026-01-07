// src/mock/socialProof.ts
import { isDemoMode } from "../mock";

export type SocialProofType =
  | "testimonial"
  | "case"
  | "before_after"
  | "certificate"
  | "review";

export type FunnelStage =
  | "curioso"
  | "cético"
  | "sensível_preço"
  | "empolgado"
  | "pronto"
  | "frustrado"
  | "geral";

export type ObjectionKey =
  | "preco"
  | "confianca"
  | "medo_robo"
  | "tempo"
  | "resultado"
  | "atendimento"
  | "outros";

export type SocialProofItem = {
  id: string;
  created_at: string;
  updated_at: string;

  type: SocialProofType;
  title: string;

  // imagem (por enquanto URL; no PROD vira upload para storage)
  imageUrl: string;

  // texto que acompanha / roteiro de envio
  suggestedText: string;

  // metadados para recomendação
  tags: string[];
  bestForStages: FunnelStage[];
  bestForObjections: ObjectionKey[];

  // opcional: origem
  source?: "whatsapp" | "instagram" | "google" | "manual";
};

const LS_KEY = "doca:social_proof:v1";

function nowIso() {
  return new Date().toISOString();
}

function seededId() {
  return `sp_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function getDefaultSocialProofSeed(): SocialProofItem[] {
  // Seed legal para demo inicial (sem depender de upload)
  // imagens são placeholders (troque quando quiser)
  return [
    {
      id: seededId(),
      created_at: nowIso(),
      updated_at: nowIso(),
      type: "testimonial",
      title: "Depoimento — rapidez no WhatsApp",
      imageUrl:
        "https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=900&q=80",
      suggestedText:
        "Olha esse feedback real 👇\n\nA gente reduziu o tempo de resposta e aumentou a conversão no WhatsApp com follow-up inteligente.\n\nQuer que eu te mostre como fica no seu caso?",
      tags: ["atendimento", "sla", "follow-up"],
      bestForStages: ["frustrado", "curioso", "empolgado"],
      bestForObjections: ["atendimento", "tempo"],
      source: "manual",
    },
    {
      id: seededId(),
      created_at: nowIso(),
      updated_at: nowIso(),
      type: "case",
      title: "Case — aumento de leads qualificados",
      imageUrl:
        "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80",
      suggestedText:
        "Case rápido 👇\n\nCom automação + qualificação, aumentamos o volume de leads bons e reduzimos o trabalho manual.\n\nSe você quiser, eu te mostro os números e como aplicamos.",
      tags: ["resultado", "qualificacao", "roi"],
      bestForStages: ["cético", "sensível_preço", "curioso"],
      bestForObjections: ["resultado", "preco", "confianca"],
      source: "manual",
    },
    {
      id: seededId(),
      created_at: nowIso(),
      updated_at: nowIso(),
      type: "certificate",
      title: "Selo — processo e segurança",
      imageUrl:
        "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
      suggestedText:
        "Só pra te dar mais segurança 👇\n\nA gente trabalha com processo, monitoramento e regras claras pra não ficar robótico.\n\nQuer que eu te mostre como personalizamos o tom da sua marca?",
      tags: ["confianca", "processo", "seguranca"],
      bestForStages: ["cético", "curioso"],
      bestForObjections: ["confianca", "medo_robo"],
      source: "manual",
    },
  ];
}

export function getSocialProofItems(): SocialProofItem[] {
  // Em PROD, por enquanto também usa localStorage (até migrar p/ Supabase),
  // mas a ideia é: se não for demo, você pode escolher depois.
  const raw = localStorage.getItem(LS_KEY);

  if (!raw) {
    // seed inicial
    const seed = getDefaultSocialProofSeed();
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SocialProofItem[];
  } catch {
    // ignore
  }

  const seed = getDefaultSocialProofSeed();
  localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return seed;
}

export function saveSocialProofItems(items: SocialProofItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function addSocialProofItem(
  partial: Omit<SocialProofItem, "id" | "created_at" | "updated_at">
): SocialProofItem {
  const items = getSocialProofItems();
  const item: SocialProofItem = {
    ...partial,
    id: seededId(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const next = [item, ...items];
  saveSocialProofItems(next);
  return item;
}

export function updateSocialProofItem(
  id: string,
  patch: Partial<Omit<SocialProofItem, "id" | "created_at">>
) {
  const items = getSocialProofItems();
  const next = items.map((x) =>
    x.id === id ? { ...x, ...patch, updated_at: nowIso() } : x
  );
  saveSocialProofItems(next);
  return next;
}

export function deleteSocialProofItem(id: string) {
  const items = getSocialProofItems();
  const next = items.filter((x) => x.id !== id);
  saveSocialProofItems(next);
  return next;
}

// Helper pra sugestão (no futuro isso vai ser "IA recomendando")
export function recommendSocialProof(opts: {
  stage?: FunnelStage;
  objections?: ObjectionKey[];
  tags?: string[];
  limit?: number;
}) {
  const { stage, objections = [], tags = [], limit = 6 } = opts;
  const items = getSocialProofItems();

  const scored = items
    .map((it) => {
      let score = 0;

      if (stage && (it.bestForStages || []).includes(stage)) score += 4;
      for (const o of objections) {
        if ((it.bestForObjections || []).includes(o)) score += 3;
      }
      for (const t of tags) {
        if ((it.tags || []).includes(t)) score += 1;
      }

      // prioridade natural: mais novo = leve boost
      score += 0.05;

      return { it, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.it);

  return scored;
}
