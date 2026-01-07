import { useEffect, useMemo, useState } from "react";
import { isDemoMode, getDemoData } from "../mock";

// ---------------------------------------------------------
// Tipos de retorno (flexíveis pra não quebrar o app)
// ---------------------------------------------------------
type DashboardMetrics = {
  total_leads: number;
  avg_health_score: number;
  avg_temperature: number;
  stage_distribution: Record<string, number>;
  urgency_distribution: Record<string, number>;
  total_emotion_events: number;
};

type EmotionalFunnelStage = {
  stage: string;
  count: number;
  percentage: number;
};

type EmotionalFunnelResponse = {
  funnel: EmotionalFunnelStage[];
};

type SentimentMatrixPoint = {
  id: string;
  name?: string;
  phone?: string;
  emotion: string;
  stage: string;

  sentiment: number; // -1..1
  intention: number; // 0..1

  health_score?: number;
};

type SentimentMatrixResponse = {
  data: SentimentMatrixPoint[];
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

/**
 * Use sempre caminhos começando com /api
 * porque o Traefik manda /api/* para o webhook.
 */
const API_BASE = "/api/dashboard";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  // ❗ Quando o endpoint está errado, costuma cair no index.html do SPA
  if (contentType.includes("text/html")) {
    const text = await res.text();
    throw new Error(
      `Endpoint retornou HTML (provável rota errada). URL: ${url}. Exemplo: ${text.slice(
        0,
        60
      )}...`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url}. ${text}`);
  }

  return (await res.json()) as T;
}

function safeNumber(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Converte leads demo em dados pra matriz e funil.
 * (No PROD você pluga nos endpoints reais.)
 */
function buildDemoFunnelAndMatrix() {
  const demo = getDemoData();
  const leads = demo?.leads || [];

  // Funil emocional: contagem por stage (emotional stage)
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const stage = (l.stage || "unknown").toString();
    counts[stage] = (counts[stage] || 0) + 1;
  }
  const total = leads.length || 1;

  const funnel: EmotionalFunnelStage[] = Object.entries(counts)
    .map(([stage, count]) => ({
      stage,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Matriz: gerar sentiment/intention plausíveis
  const emotionToSentiment: Record<string, number> = {
    skeptical: -0.6,
    anxious: -0.4,
    frustrated: -0.7,
    neutral: 0,
    curious: 0.2,
    price_sensitive: -0.1,
    excited: 0.7,
    ready: 0.9,
  };

  const stageToIntention: Record<string, number> = {
    skeptical: 0.2,
    anxious: 0.35,
    frustrated: 0.25,
    neutral: 0.4,
    curious: 0.55,
    price_sensitive: 0.5,
    excited: 0.75,
    ready: 0.95,
  };

  const matrix: SentimentMatrixPoint[] = leads.map((l: any) => {
    const emotion = (l.emotion || l.stage || "neutral").toString();
    const stage = (l.stage || "unknown").toString();

    const health = safeNumber(l.health_score, 50);

    const baseSent = emotionToSentiment[emotion] ?? 0;
    const baseInt = stageToIntention[stage] ?? 0.5;

    // pequenos ajustes baseados em health_score para espalhar pontos
    const healthBias = (health - 50) / 100; // -0.5..0.5
    const sentiment = clamp(baseSent + healthBias * 0.6, -1, 1);
    const intention = clamp(baseInt + healthBias * 0.4, 0, 1);

    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      emotion,
      stage,
      sentiment,
      intention,
      health_score: health,
    };
  });

  return {
    funnel,
    matrix,
  };
}

// ---------------------------------------------------------
// Hooks
// ---------------------------------------------------------

export function useDashboardMetrics() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const demoMode = useMemo(() => isDemoMode(), []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // ✅ DEMO MODE: usa mock
        if (demoMode) {
          const demo = getDemoData();
          const stats = demo?.stats;
          if (mounted) setData(stats as any);
          return;
        }

        // ✅ PROD/DEV real: endpoint do webhook
        const metrics = await fetchJson<DashboardMetrics>(`${API_BASE}/metrics`);

        if (mounted) setData(metrics);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Erro desconhecido");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [demoMode]);

  return { data, loading, error };
}

export function useEmotionalFunnel() {
  const [data, setData] = useState<EmotionalFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const demoMode = useMemo(() => isDemoMode(), []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // ✅ DEMO MODE
        if (demoMode) {
          const { funnel } = buildDemoFunnelAndMatrix();
          if (mounted) setData({ funnel });
          return;
        }

        /**
         * ✅ PROD/DEV real:
         * usa o endpoint real do webhook.
         * (Se por algum motivo ele falhar, fazemos fallback em metrics.)
         */
        try {
          const funnel = await fetchJson<EmotionalFunnelResponse>(
            `${API_BASE}/emotional-funnel`
          );
          if (mounted) setData(funnel);
          return;
        } catch {
          // fallback abaixo
        }

        // ✅ fallback (caso não exista o endpoint)
        const metrics = await fetchJson<DashboardMetrics>(`${API_BASE}/metrics`);

        const stageDist = metrics.stage_distribution || {};
        const total = Object.values(stageDist).reduce((a, b) => a + b, 0) || 1;

        const funnel = Object.entries(stageDist)
          .map(([stage, count]) => ({
            stage,
            count,
            percentage: Math.round((count / total) * 100),
          }))
          .sort((a, b) => b.count - a.count);

        if (mounted) setData({ funnel });
      } catch (e: any) {
        if (mounted) setError(e?.message || "Erro desconhecido");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [demoMode]);

  return { data, loading, error };
}

export function useSentimentMatrix() {
  const [data, setData] = useState<SentimentMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const demoMode = useMemo(() => isDemoMode(), []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // ✅ DEMO MODE
        if (demoMode) {
          const { matrix } = buildDemoFunnelAndMatrix();
          if (mounted) setData({ data: matrix });
          return;
        }

        /**
         * ✅ PROD/DEV real:
         * endpoint já existe no webhook:
         * GET /api/dashboard/sentiment-matrix
         */
        const matrix = await fetchJson<SentimentMatrixResponse>(
          `${API_BASE}/sentiment-matrix`
        );

        if (mounted) setData(matrix);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Erro desconhecido");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [demoMode]);

  return { data, loading, error };
}
