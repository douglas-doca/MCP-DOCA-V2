/// <reference types="vite/client" />
// src/mock/generator/index.ts

import type {
  DemoData,
  DemoConversation,
  DemoLead,
  DemoMessage,
  DemoStats,
} from "../types";

// ✅ NÃO usamos mais templates fixos
// ✅ DemoNiche agora é apenas string (mantém compatibilidade com o resto do app)
export type DemoNiche = string;

// ==============================
// Types
// ==============================

export type GenerateDemoParams = {
  niche: DemoNiche;

  // seed / key
  seedKey?: string;

  // business context
  businessName?: string;
  city?: string;
  instagram?: string;
  website?: string;
  offer?: string;
  mainPain?: string;
  objections?: string;

  // sizing
  leadsPerMonth?: number;
  conversationsCount?: number;
};

// ==============================
// Helpers
// ==============================

function nowIso() {
  return new Date().toISOString();
}

function randInt(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seededHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function makeRng(seed: string) {
  let x = seededHash(seed) || 123456789;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

// ==============================
// Main
// ==============================

export function generateDemoData(params: GenerateDemoParams): DemoData {
  const niche = (params.niche || "default") as DemoNiche;

  const seed = params.seedKey || `${niche}-${params.businessName || "demo"}`;
  const rng = makeRng(seed);

  // ✅ defaults (agora sem template)
  const businessName = params.businessName || "Cliente Demo";
  const city = params.city || "São Paulo";
  const instagram = params.instagram || "";
  const website = params.website || "";
  const offer = params.offer || "";
  const mainPain = params.mainPain || "";
  const objections = params.objections || "";

  const leadsPerMonth = clamp(Number(params.leadsPerMonth ?? 120), 10, 10000);
  const conversationsCount = clamp(Number(params.conversationsCount ?? 60), 5, 600);

  // ------------------------------
  // STATS
  // ------------------------------
  const stats: DemoStats = {
    conversations_last_7d: Math.round(conversationsCount * 0.7),
    leads_last_7d: Math.round((leadsPerMonth / 4) * (0.8 + rng() * 0.4)),
    qualified_last_7d: Math.round((leadsPerMonth / 12) * (0.7 + rng() * 0.6)),
    avg_response_time_s: Math.round(10 + rng() * 30),
    updated_at: nowIso(),
    business: {
      name: businessName,
      city,
      instagram,
      website,
      offer,
      mainPain,
      objections,
      niche,
    },
  } as any;

  // ------------------------------
  // LEADS
  // ------------------------------
  const leadsCount = clamp(
    Math.round(conversationsCount * (0.45 + rng() * 0.25)),
    8,
    220
  );

  const stagePool = [
    "curioso",
    "cético",
    "sensível_preço",
    "empolgado",
    "pronto",
    "frustrado",
  ];

  const leads: DemoLead[] = Array.from({ length: leadsCount }).map((_, i) => {
    const id = `lead-${seededHash(`${seed}-lead-${i}`)}-${i}`;
    const phone = `55${randInt(11, 99)}9${randInt(1000, 9999)}${randInt(1000, 9999)}`;

    const health = clamp(Math.round(40 + rng() * 55), 0, 100);
    const conversion = clamp(0.15 + rng() * 0.75, 0, 1);

    const urgencyPool = ["low", "normal", "high", "critical"] as const;
    const urgency = pick([...urgencyPool]);

    const stage = pick([...stagePool]);

    return {
      id,
      phone,
      name: null,
      health_score: health,
      stage,
      urgency_level: urgency,
      conversion_probability: conversion,
      tags: [],
      updated_at: nowIso(),
      created_at: nowIso(),
    } as any;
  });

  // ------------------------------
  // CONVERSATIONS + MESSAGES
  // ------------------------------
  const conversations: DemoConversation[] = [];
  const messages: DemoMessage[] = [];

  for (let i = 0; i < conversationsCount; i++) {
    const lead = leads[Math.floor(rng() * leads.length)];
    const convId = `conv-${seededHash(`${seed}-conv-${i}`)}-${i}`;

    const convoMsgs = [
      { from: "lead", text: `Oi! Vi sobre ${businessName}. Como funciona?` },
      {
        from: "agent",
        text: `Oi! 😊 Funciona assim: a gente automatiza atendimento + qualificação + follow-up no WhatsApp. Quer que eu te explique rapidinho?`,
      },
      { from: "lead", text: `Sim, tenho dúvida sobre preço e como instala.` },
      {
        from: "agent",
        text: `Show! Te explico os planos e a implementação é bem rápida (em minutos). Me diz seu volume de leads/mês?`,
      },
    ];

    const created_at = new Date(Date.now() - randInt(1, 7) * 86400000).toISOString();

    const last_message =
      convoMsgs.length > 0
        ? String(convoMsgs[convoMsgs.length - 1]?.text || "—")
        : "—";

    conversations.push({
      id: convId,
      phone: lead.phone,
      name: lead.name,
      status: "active",
      last_message,
      current_emotion: lead.stage,
      created_at,
      updated_at: nowIso(),
      lead_id: lead.id,
      tags: [],
    } as any);

    convoMsgs.forEach((m: any, j: number) => {
      messages.push({
        id: `msg-${seededHash(`${seed}-msg-${i}-${j}`)}-${i}-${j}`,
        conversation_id: convId,
        from: m.from,
        text: String(m.text || ""),
        created_at: new Date(
          Date.now() - randInt(1, 7) * 86400000 + j * 120000
        ).toISOString(),
      } as any);
    });
  }

  return {
    stats,
    leads,
    conversations,
    messages,
    emotion_events: [],
  } as any;
}
