/// <reference types="vite/client" />
// src/mock/index.ts

import type { DemoData } from "./types";

// ✅ Generator (new)
import { generateDemoData, type DemoNiche } from "./generator";

import {
  loadGeneratedDemo as storageLoadGeneratedDemo,
  listGeneratedDemos as storageListGeneratedDemos,
  deleteGeneratedDemo as storageDeleteGeneratedDemo,
  saveGeneratedDemo as storageSaveGeneratedDemo,
  type GeneratedDemoSummary,
} from "./generator/storage";

// ==============================
// ✅ DEMO KEYS
// ==============================

export type DemoKey = string;

// ==============================
// Helpers
// ==============================

function getEnvDemo(): string {
  return (import.meta.env.VITE_DEMO || "").toString().trim().toLowerCase();
}

function getUrlDemo(): string {
  try {
    const url = new URL(window.location.href);
    return (url.searchParams.get("demo") || "").toString().trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Demo mode = quando existe `?demo=` na url OU VITE_DEMO no env.
 * ⚠️ No PROD isso não deve existir
 */
export function isDemoMode(): boolean {
  return Boolean(getUrlDemo() || getEnvDemo());
}

export function getDemoKey(): DemoKey {
  const key = (getUrlDemo() || getEnvDemo() || "").toString().trim().toLowerCase();
  if (!key) return "";

  const gen = storageLoadGeneratedDemo(key);
  if (gen) return key;

  // ✅ AUTO-GENERATE: se não existe, gera e salva automaticamente
  try {
    const demo = generateDemoData({
      niche: "restaurante", // default (pode mudar)
      seedKey: key,
      businessName: key,
      city: "São Paulo",
      instagram: "@docaperformance",
      website: "docaperformance.com.br",
      offer: "DOCA Multi Agentes (WhatsApp + IA + Dashboard)",
      mainPain: "Muitos leads e pouco atendimento",
      objections: "Medo de parecer robô / preço / integração",
      leadsPerMonth: 120,
      conversationsCount: 36,
    });

    storageSaveGeneratedDemo(key, demo, {
      label: `Demo • ${key}`,
      niche: "restaurante",
    });

    return key;
  } catch (err) {
    console.error("[demo] Failed to auto-generate demo:", err);
    return "";
  }
}

/**
 * Lista que alimenta o dropdown do topo.
 * ✅ Só geradas
 */
export function getAllDemoOptions(): Array<{
  key: string;
  label: string;
  source: "generated";
}> {
  const generated = storageListGeneratedDemos().map((d) => ({
    key: d.key,
    label: d.label,
    source: "generated" as const,
  }));

  const currentKey = (getUrlDemo() || getEnvDemo() || "").toString().trim().toLowerCase();
  if (currentKey && !generated.some((d) => d.key === currentKey)) {
    // força que apareça no dropdown mesmo que ainda não tenha sido listada
    generated.unshift({
      key: currentKey,
      label: `Demo • ${currentKey}`,
      source: "generated",
    });
  }

  if (generated.length === 0) {
    return [
      {
        key: "",
        label: "(sem demos geradas)",
        source: "generated",
      },
    ];
  }

  return generated;
}

/**
 * Carrega a demo ativa.
 * ✅ Só geradas
 * Se não tiver -> retorna mock vazio (não quebra)
 */
export function getDemoData(): DemoData {
  const key = getDemoKey();

  if (key) {
    const gen = storageLoadGeneratedDemo(key);
    if (gen) return gen as any;
  }

  // ✅ fallback vazio (pra não quebrar o app)
  return makeEmptyDemo();
}

// ==============================
// ✅ Generator helpers (pra DemoGeneratorPage)
// ==============================

export type { DemoNiche, GeneratedDemoSummary };

/**
 * Gera uma demo e salva no localStorage.
 * Retorna a key (pra você redirecionar via ?demo=key)
 */
export function generateDemoAndStore(params: {
  key: string;
  niche: DemoNiche;
  businessName: string;
  city?: string;
  instagram?: string;
  website?: string;
  offer?: string;
  mainPain?: string;
  objections?: string;
  leadsPerMonth?: number;
  conversationsCount?: number;
}) {
  const demo = generateDemoData({
    niche: params.niche,
    seedKey: params.key,
    businessName: params.businessName,
    city: params.city,
    instagram: params.instagram,
    website: params.website,
    offer: params.offer,
    mainPain: params.mainPain,
    objections: params.objections,
    leadsPerMonth: params.leadsPerMonth,
    conversationsCount: params.conversationsCount,
  });

  storageSaveGeneratedDemo(params.key, demo, {
    label: params.businessName || params.key,
    niche: params.niche,
  });

  return { key: params.key };
}

/**
 * Lista demos geradas (localStorage)
 */
export function listGeneratedDemos(): GeneratedDemoSummary[] {
  return storageListGeneratedDemos();
}

/**
 * Apaga demo gerada (localStorage)
 */
export function removeGeneratedDemo(key: string) {
  return storageDeleteGeneratedDemo(key);
}

// ==============================
// ✅ Fallback (não quebra)
// ==============================

function makeEmptyDemo(): DemoData {
  const now = new Date().toISOString();

  return {
    stats: {
      conversations_last_7d: 0,
      leads_last_7d: 0,
      qualified_last_7d: 0,
      avg_response_time_s: 0,
      updated_at: now,
    } as any,
    conversations: [],
    leads: [],
    messages: [],
    emotion_events: [],
  } as any;
}

// reexport tipos do mock para facilitar import
export type {
  DemoData,
  DemoLead,
  DemoConversation,
  DemoMessage,
  DemoEmotionEvent,
  DemoStats,
} from "./types";
