// src/pages/TrainingPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Save,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  Tag,
  BookOpen,
  TestTube2,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  Filter,
  ImageIcon,
} from "lucide-react";

/**
 * TrainingPage (Premium SaaS)
 * - Prompt Editor (settings key=agent_prompt)
 * - Knowledge Base CRUD (/api/knowledge)
 * - Playground (mockado por enquanto)
 *
 * + ✅ Prova Social Library (Supabase storage + tabela)
 */

import SocialProofLibrary from "../components/SocialProofLibrary"; // ✅ adicionamos

// -----------------------------------------------------
// Types
// -----------------------------------------------------
type SettingResponse = { key: string; value: string };

type KnowledgeItem = {
  id?: string;
  question: string;
  answer: string;
  category?: string | null;
  priority?: number | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

type PlaygroundContext = {
  stage: string;
  emotion: string;
  channel: string;
};

// -----------------------------------------------------
// API Helpers
// -----------------------------------------------------
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";

  // quando rota errada -> volta HTML
  if (contentType.includes("text/html")) {
    const text = await res.text();
    throw new Error(
      `Endpoint retornou HTML (provável rota errada): ${url}. Ex: ${text.slice(
        0,
        80
      )}...`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url}. ${text}`);
  }

  return (await res.json()) as T;
}

async function getAgentPrompt(): Promise<string> {
  try {
    const data = await fetchJson<SettingResponse>("/api/settings?key=agent_prompt");
    return (data?.value || "").toString();
  } catch {
    // se setting não existir ainda, retorna vazio (não quebra)
    return "";
  }
}

async function saveAgentPrompt(value: string): Promise<void> {
  await fetchJson("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "agent_prompt", value }),
  });
}

async function getKnowledge(category?: string): Promise<KnowledgeItem[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  const data = await fetchJson<KnowledgeItem[]>(`/api/knowledge${qs}`);
  return Array.isArray(data) ? data : [];
}

async function saveKnowledge(item: KnowledgeItem): Promise<void> {
  await fetchJson("/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
}

async function deleteKnowledge(id: string): Promise<void> {
  await fetchJson("/api/knowledge", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

// -----------------------------------------------------
// UI Helpers
// -----------------------------------------------------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useToast() {
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    title: string;
    desc?: string;
  } | null>(null);

  const timer = useRef<number | null>(null);

  function show(t: { type: "success" | "error" | "info"; title: string; desc?: string }) {
    setToast(t);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }

  return { toast, show, clear: () => setToast(null) };
}

/**
 * Fallback GlassCard (caso seu projeto não tenha)
 * Se você já tem GlassCard no projeto, pode remover isso e importar.
 */
function GlassCard(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { title, subtitle, right, children, className } = props;
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
        className
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white font-semibold text-lg">{title}</p>
            {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
          </div>
          {right}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Main Page
// -----------------------------------------------------
export default function TrainingPage() {
  const { toast, show, clear } = useToast();

  // Prompt
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [promptOriginal, setPromptOriginal] = useState("");

  // Knowledge
  const [kbLoading, setKbLoading] = useState(true);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbDeleting, setKbDeleting] = useState<string | null>(null);
  const [kb, setKb] = useState<KnowledgeItem[]>([]);
  const [kbSearch, setKbSearch] = useState("");
  const [kbCategory, setKbCategory] = useState<string>("all");
  const [kbCategoryOpen, setKbCategoryOpen] = useState(false);

  // Modal create/edit KB
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [kbEditing, setKbEditing] = useState<KnowledgeItem | null>(null);

  // Playground
  const [playContext, setPlayContext] = useState<PlaygroundContext>({
    stage: "curioso",
    emotion: "neutral",
    channel: "whatsapp",
  });
  const [playInput, setPlayInput] = useState("");
  const [playOutput, setPlayOutput] = useState<{
    answer: string;
    sources: Array<{ question: string; category?: string | null }>;
    confidence: number;
    escalate: boolean;
    rationale: string;
  } | null>(null);
  const [playLoading, setPlayLoading] = useState(false);

  // Tabs dentro do treinamento (para adicionar Prova Social)
  const [tab, setTab] = useState<"prompt" | "knowledge" | "social" | "playground">("prompt");

  const categories = useMemo(() => {
    const all = new Set<string>();
    kb.forEach((x) => {
      const c = (x.category || "").trim();
      if (c) all.add(c);
    });
    return ["all", ...Array.from(all).sort((a, b) => a.localeCompare(b))];
  }, [kb]);

  const filteredKb = useMemo(() => {
    const q = kbSearch.trim().toLowerCase();
    return kb.filter((item) => {
      const catOK = kbCategory === "all" ? true : (item.category || "") === kbCategory;
      if (!catOK) return false;

      if (!q) return true;

      const hay = `${item.question}\n${item.answer}\n${(item.tags || []).join(" ")}\n${item.category || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [kb, kbSearch, kbCategory]);

  const promptDirty = useMemo(() => promptValue !== promptOriginal, [promptValue, promptOriginal]);

  // -----------------------------------------------------
  // Load data
  // -----------------------------------------------------
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    await Promise.all([loadPrompt(), loadKb()]);
  }

  async function loadPrompt() {
    try {
      setPromptLoading(true);
      const p = await getAgentPrompt();
      setPromptValue(p);
      setPromptOriginal(p);
    } catch (e: any) {
      show({ type: "error", title: "Erro ao carregar prompt", desc: e?.message });
    } finally {
      setPromptLoading(false);
    }
  }

  async function loadKb() {
    try {
      setKbLoading(true);
      const data = await getKnowledge();
      setKb(data);
    } catch (e: any) {
      show({ type: "error", title: "Erro ao carregar base", desc: e?.message });
    } finally {
      setKbLoading(false);
    }
  }

  // -----------------------------------------------------
  // Prompt Actions
  // -----------------------------------------------------
  async function onSavePrompt() {
    const value = promptValue.trim();
    if (!value) {
      show({ type: "error", title: "Prompt vazio", desc: "Escreva um prompt antes de salvar." });
      return;
    }

    try {
      setPromptSaving(true);
      await saveAgentPrompt(value);
      setPromptOriginal(value);
      show({ type: "success", title: "Prompt salvo", desc: "Configuração aplicada no backend." });
    } catch (e: any) {
      show({ type: "error", title: "Falha ao salvar prompt", desc: e?.message });
    } finally {
      setPromptSaving(false);
    }
  }

  function onResetPrompt() {
    setPromptValue(promptOriginal);
    show({ type: "info", title: "Prompt restaurado", desc: "Voltando para a última versão salva." });
  }

  // -----------------------------------------------------
  // KB Actions
  // -----------------------------------------------------
  function openCreateKb() {
    setKbEditing(null);
    setKbModalOpen(true);
  }

  function openEditKb(item: KnowledgeItem) {
    setKbEditing(item);
    setKbModalOpen(true);
  }

  async function onDeleteKb(item: KnowledgeItem) {
    if (!item.id) return;

    const ok = window.confirm("Remover este item da base de conhecimento?");
    if (!ok) return;

    try {
      setKbDeleting(item.id);
      await deleteKnowledge(item.id);
      show({ type: "success", title: "Removido", desc: "Item removido da base." });
      await loadKb();
    } catch (e: any) {
      show({ type: "error", title: "Erro ao remover", desc: e?.message });
    } finally {
      setKbDeleting(null);
    }
  }

  async function onSaveKbModal(item: KnowledgeItem) {
    // validações
    if (!item.question?.trim()) {
      show({ type: "error", title: "Pergunta obrigatória" });
      return;
    }
    if (!item.answer?.trim()) {
      show({ type: "error", title: "Resposta obrigatória" });
      return;
    }

    try {
      setKbSaving(true);
      await saveKnowledge({
        ...item,
        category: (item.category || "").trim() || null,
        priority: typeof item.priority === "number" ? item.priority : 3,
        tags: Array.isArray(item.tags) ? item.tags : [],
      });

      show({ type: "success", title: item.id ? "Atualizado" : "Adicionado", desc: "Base de conhecimento salva." });
      setKbModalOpen(false);
      setKbEditing(null);
      await loadKb();
    } catch (e: any) {
      show({ type: "error", title: "Erro ao salvar", desc: e?.message });
    } finally {
      setKbSaving(false);
    }
  }

  // -----------------------------------------------------
  // Playground (mockado, mas premium)
  // -----------------------------------------------------
  async function onRunPlayground() {
    const input = playInput.trim();
    if (!input) {
      show({ type: "error", title: "Digite uma mensagem", desc: "Simule uma pergunta do lead para testar." });
      return;
    }

    try {
      setPlayLoading(true);
      setPlayOutput(null);

      // Simula "IA" usando KB local: pega top 2 FAQs mais relevantes (match simples)
      const q = input.toLowerCase();
      const scored = kb
        .map((k) => {
          const hay = `${k.question}\n${k.answer}\n${(k.tags || []).join(" ")}\n${k.category || ""}`.toLowerCase();
          let score = 0;
          q.split(/\s+/).forEach((w) => {
            if (w.length >= 3 && hay.includes(w)) score += 1;
          });
          // boost por prioridade
          score += ((k.priority || 3) - 1) * 0.25;
          return { k, score };
        })
        .sort((a, b) => b.score - a.score);

      const sources = scored
        .filter((x) => x.score > 0)
        .slice(0, 2)
        .map((x) => ({
          question: x.k.question,
          category: x.k.category || null,
        }));

      // resposta “premium fake” (até plugar no backend)
      const escalate = playContext.emotion === "frustrated" || playContext.stage === "frustrado";
      const confidence = clamp01(
        0.62 +
          (sources.length > 0 ? 0.18 : -0.08) +
          (playContext.emotion === "ready" ? 0.12 : 0) +
          (playContext.emotion === "skeptical" ? -0.08 : 0)
      );

      const answer = buildMockAnswer({
        input,
        ctx: playContext,
        sources,
      });

      setPlayOutput({
        answer,
        sources,
        confidence: Math.round(confidence * 100),
        escalate,
        rationale:
          sources.length > 0
            ? "A resposta foi composta usando os itens mais relevantes da Base de Conhecimento."
            : "Sem match forte na Base de Conhecimento; resposta gerada com heurística padrão.",
      });
    } catch (e: any) {
      show({ type: "error", title: "Falha no teste", desc: e?.message });
    } finally {
      setPlayLoading(false);
    }
  }

  // -----------------------------------------------------
  // Render
  // -----------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-[#f57f17]" />
            Treinamento
          </h2>
          <p className="text-gray-500 text-sm">
            Configure o comportamento do agente e melhore as respostas com uma base de conhecimento viva.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
          <div className="h-8 w-8 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#f57f17]" />
          </div>
          <div className="leading-tight">
            <p className="text-sm text-white font-semibold">Modo Treinamento</p>
            <p className="text-xs text-gray-500">Prompt + Knowledge + Prova Social + Testes</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<Brain className="w-4 h-4" />}
          label="Prompt"
        />
        <TabButton
          active={tab === "knowledge"}
          onClick={() => setTab("knowledge")}
          icon={<BookOpen className="w-4 h-4" />}
          label="Knowledge Base"
        />
        <TabButton
          active={tab === "social"}
          onClick={() => setTab("social")}
          icon={<ImageIcon className="w-4 h-4" />}
          label="Prova Social"
        />
        <TabButton
          active={tab === "playground"}
          onClick={() => setTab("playground")}
          icon={<TestTube2 className="w-4 h-4" />}
          label="Playground"
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-50">
          <div
            className={cn(
              "rounded-2xl border backdrop-blur-xl px-4 py-3 shadow-xl w-[360px]",
              toast.type === "success" && "border-emerald-500/25 bg-emerald-500/10",
              toast.type === "error" && "border-red-500/25 bg-red-500/10",
              toast.type === "info" && "border-white/10 bg-white/5"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {toast.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                ) : toast.type === "error" ? (
                  <XCircle className="w-5 h-5 text-red-300" />
                ) : (
                  <Info className="w-5 h-5 text-gray-300" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{toast.title}</p>
                {toast.desc && <p className="text-gray-300 text-sm mt-1">{toast.desc}</p>}
              </div>

              <button onClick={clear} className="text-gray-400 hover:text-gray-200">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ TAB: PROMPT ------------------ */}
      {tab === "prompt" && (
        <GlassCard
          title="Prompt do Agente"
          subtitle="Defina as regras, tom e objetivo. Essa é a “mente” do agente."
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={onResetPrompt}
                disabled={!promptDirty || promptLoading || promptSaving}
                className={cn(
                  "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                  !promptDirty || promptLoading || promptSaving
                    ? "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                    : "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Restaurar
              </button>

              <button
                onClick={onSavePrompt}
                disabled={promptLoading || promptSaving || !promptDirty}
                className={cn(
                  "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                  promptLoading || promptSaving || !promptDirty
                    ? "border-[#f57f17]/20 bg-[#f57f17]/10 text-[#f57f17]/60 cursor-not-allowed"
                    : "border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
                )}
              >
                {promptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          }
        >
          {promptLoading ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando prompt…
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="font-semibold text-white">agent_prompt</span>
                    <span className="text-gray-600">•</span>
                    <span className={promptDirty ? "text-[#f57f17]" : "text-gray-500"}>
                      {promptDirty ? "Não salvo" : "Salvo"}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    Dica: inclua regras + tom + coleta de dados + fechamento
                  </div>
                </div>

                <textarea
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="w-full min-h-[340px] p-4 bg-transparent outline-none resize-none font-mono text-sm text-gray-200 placeholder:text-gray-600"
                  placeholder={`Exemplo:
Você é um atendente especialista.
- Seja direto e consultivo.
- Sempre pergunte Nome + Segmento.
- Nunca prometa garantias irreais.
- Se lead estiver frustrado, escale para humano.`}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <QuickChip title="Objetivo" desc="Converter leads com clareza" />
                <QuickChip title="Tom" desc="Premium, consultivo, assertivo" />
                <QuickChip title="Regras" desc="Compliance + escalonamento" />
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* ------------------ TAB: KNOWLEDGE ------------------ */}
      {tab === "knowledge" && (
        <GlassCard
          title="Base de Conhecimento"
          subtitle="Perguntas e respostas que a IA usa como referência para atender com consistência."
          right={
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setKbCategoryOpen((v) => !v)}
                  className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
                >
                  <Filter className="w-4 h-4 text-gray-400" />
                  {kbCategory === "all" ? "Todas categorias" : kbCategory}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {kbCategoryOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-xl overflow-hidden z-10">
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setKbCategory(c);
                          setKbCategoryOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 text-sm hover:bg-white/5",
                          kbCategory === c ? "text-white font-semibold" : "text-gray-200"
                        )}
                      >
                        {c === "all" ? "Todas categorias" : c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={openCreateKb}
                className="h-10 px-4 rounded-2xl border border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 transition-all flex items-center gap-2 text-sm font-semibold shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          }
        >
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="Buscar por pergunta, resposta, tags..."
                className="w-full h-10 rounded-2xl bg-white/5 border border-white/10 pl-10 pr-3 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
              <Tag className="w-4 h-4 text-gray-600" />
              {kb.length} itens
            </div>
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {kbLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-3 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando base…
                </div>
              </div>
            ) : filteredKb.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-6 text-center">
                <p className="text-white font-semibold">Nenhum item encontrado</p>
                <p className="text-gray-500 text-sm mt-1">
                  Ajuste filtros ou adicione perguntas e respostas para enriquecer a IA.
                </p>
                <button
                  onClick={openCreateKb}
                  className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 transition-all text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" /> Adicionar item
                </button>
              </div>
            ) : (
              filteredKb.map((item) => (
                <KnowledgeRow
                  key={item.id || item.question}
                  item={item}
                  onEdit={() => openEditKb(item)}
                  onDelete={() => onDeleteKb(item)}
                  deleting={kbDeleting === item.id}
                />
              ))
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-white font-semibold text-sm">Boas práticas</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              <li>• Respostas devem ser objetivas, com exemplos e termos do seu negócio.</li>
              <li>• Use categorias: Preço, Integrações, ROI, Objeções, Garantia, Suporte…</li>
              <li>• Prioridade (1–5) define o que a IA puxa primeiro.</li>
            </ul>
          </div>
        </GlassCard>
      )}

      {/* ------------------ TAB: PROVA SOCIAL ------------------ */}
      {tab === "social" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-5 py-4">
            <p className="text-white font-semibold">Prova Social (Conviction Engine)</p>
            <p className="text-gray-500 text-sm mt-1">
              Aqui você salva prints, cases e resultados para o agente usar na hora certa (principalmente para CÉTICOS).
            </p>
          </div>

          {/* ✅ componente novo */}
          <SocialProofLibrary />
        </div>
      )}

      {/* ------------------ TAB: PLAYGROUND ------------------ */}
      {tab === "playground" && (
        <GlassCard
          title="Playground"
          subtitle="Teste o comportamento do agente com contexto (estágio, emoção e canal)."
          right={
            <button
              onClick={onRunPlayground}
              disabled={playLoading}
              className={cn(
                "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                playLoading
                  ? "border-[#f57f17]/20 bg-[#f57f17]/10 text-[#f57f17]/60 cursor-not-allowed"
                  : "border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
              )}
            >
              {playLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
              Testar
            </button>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Context */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-white font-semibold">Contexto</p>
              <p className="text-gray-500 text-sm mt-1">A IA muda resposta conforme o cenário.</p>

              <div className="mt-4 space-y-3">
                <FieldSelect
                  label="Estágio"
                  value={playContext.stage}
                  onChange={(v) => setPlayContext((s) => ({ ...s, stage: v }))}
                  options={[
                    { value: "cético", label: "Cético" },
                    { value: "frustrado", label: "Frustrado" },
                    { value: "curioso", label: "Curioso" },
                    { value: "sensível_preço", label: "Sensível a Preço" },
                    { value: "empolgado", label: "Empolgado" },
                    { value: "pronto", label: "Pronto" },
                  ]}
                />

                <FieldSelect
                  label="Emoção"
                  value={playContext.emotion}
                  onChange={(v) => setPlayContext((s) => ({ ...s, emotion: v }))}
                  options={[
                    { value: "neutral", label: "Neutral" },
                    { value: "curious", label: "Curious" },
                    { value: "price_sensitive", label: "Price Sensitive" },
                    { value: "skeptical", label: "Skeptical" },
                    { value: "frustrated", label: "Frustrated" },
                    { value: "excited", label: "Excited" },
                    { value: "ready", label: "Ready" },
                  ]}
                />

                <FieldSelect
                  label="Canal"
                  value={playContext.channel}
                  onChange={(v) => setPlayContext((s) => ({ ...s, channel: v }))}
                  options={[
                    { value: "whatsapp", label: "WhatsApp" },
                    { value: "instagram", label: "Instagram (em breve)" },
                    { value: "web", label: "Webchat (em breve)" },
                  ]}
                />
              </div>
            </div>

            {/* Input */}
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">Mensagem do lead</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Simule uma pergunta real. O sistema busca referências na Knowledge Base.
                  </p>
                </div>

                <div className="text-xs text-gray-500">{kb.length} itens na base</div>
              </div>

              <div className="mt-4">
                <textarea
                  value={playInput}
                  onChange={(e) => setPlayInput(e.target.value)}
                  placeholder="Ex: Quanto custa? Tem integração com CRM? Dá pra parcelar? Qual ROI?"
                  className="w-full min-h-[130px] p-4 rounded-2xl border border-white/10 bg-black/40 outline-none resize-none text-sm text-gray-200 placeholder:text-gray-600 focus:ring-2 focus:ring-[#f57f17]"
                />
              </div>

              {/* Output */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">Resposta do agente</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Resultado do Playground (simulado). Depois plugamos no backend de IA.
                    </p>
                  </div>

                  {playOutput && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Confiança</p>
                      <p className="text-white font-bold text-lg">{playOutput.confidence}%</p>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  {playLoading ? (
                    <div className="flex items-center gap-3 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando resposta…
                    </div>
                  ) : playOutput ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                        <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                          {playOutput.answer}
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <MiniStat
                          label="Escalonar"
                          value={playOutput.escalate ? "Sim" : "Não"}
                          tone={playOutput.escalate ? "red" : "green"}
                        />
                        <MiniStat label="Contexto" value={`${playContext.stage} • ${playContext.emotion}`} />
                        <MiniStat label="Canal" value={playContext.channel} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-white font-semibold text-sm">Fontes (Knowledge Base)</p>
                        {playOutput.sources.length === 0 ? (
                          <p className="text-gray-500 text-sm mt-1">
                            Nenhum item da base foi “match forte”. Adicione FAQs para aumentar consistência.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {playOutput.sources.map((s, idx) => (
                              <div
                                key={idx}
                                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2"
                              >
                                <p className="text-gray-200 text-sm font-semibold">{s.question}</p>
                                {s.category && <p className="text-gray-500 text-xs mt-0.5">{s.category}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-gray-500 text-xs mt-3">{playOutput.rationale}</p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-6 text-center">
                      <p className="text-white font-semibold">Nenhum teste rodou ainda</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Escolha contexto, digite uma mensagem e clique em Testar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* KB Modal */}
      {kbModalOpen && (
        <KbModal
          saving={kbSaving}
          item={kbEditing}
          onClose={() => {
            setKbModalOpen(false);
            setKbEditing(null);
          }}
          onSave={onSaveKbModal}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------
// Components
// -----------------------------------------------------
function TabButton(props: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className={cn(
        "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold whitespace-nowrap",
        props.active
          ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white shadow-[0_0_0_1px_rgba(245,127,23,0.14)]"
          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
      )}
    >
      <span className={props.active ? "text-[#f57f17]" : "text-gray-400"}>{props.icon}</span>
      {props.label}
    </button>
  );
}

function QuickChip(props: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <p className="text-gray-500 text-xs">{props.title}</p>
      <p className="text-white font-semibold text-sm mt-1">{props.desc}</p>
    </div>
  );
}

function KnowledgeRow(props: {
  item: KnowledgeItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const { item, onEdit, onDelete, deleting } = props;

  const priority = typeof item.priority === "number" ? item.priority : 3;
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 hover:bg-black/35 transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-white font-semibold">{item.question}</p>
            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.answer}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.category && (
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-white/5 border border-white/10 text-gray-200">
                  <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                  {item.category}
                </span>
              )}

              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-[#f57f17]/10 border border-[#f57f17]/20 text-[#f57f17]">
                Prioridade {priority}
              </span>

              {tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-black/30 border border-white/10 text-gray-300"
                >
                  <Tag className="w-3.5 h-3.5 text-gray-500" />
                  {t}
                </span>
              ))}
              {tags.length > 3 && <span className="text-xs text-gray-500">+{tags.length - 3}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200"
            >
              Editar
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className={cn(
                "h-10 w-10 rounded-2xl border transition-all flex items-center justify-center",
                deleting
                  ? "border-red-500/20 bg-red-500/10 text-red-300 cursor-not-allowed"
                  : "border-white/10 bg-white/5 hover:bg-white/10 text-gray-200"
              )}
              title="Remover"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{props.label}</p>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniStat(props: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-xs text-gray-500">{props.label}</p>
      <p
        className={cn(
          "text-white font-semibold text-sm mt-1",
          props.tone === "green" && "text-emerald-200",
          props.tone === "red" && "text-red-200"
        )}
      >
        {props.value}
      </p>
    </div>
  );
}

function KbModal(props: {
  item: KnowledgeItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (item: KnowledgeItem) => void;
}) {
  const { item, saving, onClose, onSave } = props;

  const [question, setQuestion] = useState(item?.question || "");
  const [answer, setAnswer] = useState(item?.answer || "");
  const [category, setCategory] = useState(item?.category || "");
  const [priority, setPriority] = useState<number>(typeof item?.priority === "number" ? item!.priority! : 3);
  const [tags, setTags] = useState((item?.tags || []).join(", "));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-black/85 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-lg">{item?.id ? "Editar item" : "Adicionar item"}</p>
            <p className="text-gray-500 text-sm mt-1">
              Mantenha respostas claras e úteis. Isso afeta diretamente a performance.
            </p>
          </div>

          <button
            onClick={onClose}
            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500">Pergunta</p>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full h-10 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
              placeholder="Ex: Quanto custa? Vocês integram com CRM?"
            />
          </div>

          <div>
            <p className="text-xs text-gray-500">Resposta</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="mt-1 w-full min-h-[140px] rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm p-3 outline-none resize-none focus:ring-2 focus:ring-[#f57f17]"
              placeholder="Ex: Temos plano mensal e anual. Integração via webhook + API..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">Categoria</p>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full h-10 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                placeholder="Preço, ROI, Integrações..."
              />
            </div>

            <div>
              <p className="text-xs text-gray-500">Prioridade (1–5)</p>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="mt-1 w-full h-10 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
              >
                {[1, 2, 3, 4, 5].map((x) => (
                  <option key={x} value={x} className="bg-black">
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-gray-500">Tags (separadas por vírgula)</p>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1 w-full h-10 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                placeholder="parcelamento, CRM, suporte..."
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-xs text-gray-500">Dica: quanto mais específica a pergunta, melhor a IA busca o match.</p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              onClick={() =>
                onSave({
                  id: item?.id,
                  question,
                  answer,
                  category: category || null,
                  priority,
                  tags: tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              className={cn(
                "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold",
                saving
                  ? "border-[#f57f17]/20 bg-[#f57f17]/10 text-[#f57f17]/60 cursor-not-allowed"
                  : "border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Playground Answer Builder (mockado)
// -----------------------------------------------------
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function buildMockAnswer(args: {
  input: string;
  ctx: PlaygroundContext;
  sources: Array<{ question: string; category?: string | null }>;
}) {
  const { input, ctx, sources } = args;

  // tom de voz baseado na emoção
  const tone =
    ctx.emotion === "frustrated"
      ? "empático"
      : ctx.emotion === "skeptical"
      ? "prova social"
      : ctx.emotion === "ready"
      ? "fechamento"
      : "consultivo";

  const opener =
    tone === "empático"
      ? "Entendi — faz sentido você estar incomodado. Vamos resolver isso agora."
      : tone === "prova social"
      ? "Totalmente justo ter essa dúvida. Posso te mostrar como isso funciona na prática."
      : tone === "fechamento"
      ? "Perfeito. Vamos direto ao ponto pra você fechar com segurança."
      : "Boa. Vou te explicar de um jeito rápido e claro.";

  const hint =
    sources.length > 0
      ? `\n\nBaseado na nossa base de conhecimento, aqui vai o que recomendo:`
      : `\n\nAinda não tenho um item específico na base para isso, mas aqui vai a melhor orientação:`;

  const stageLine =
    ctx.stage === "sensível_preço"
      ? "\n\nSe preço for o ponto principal, eu consigo te montar 2 opções (mensal e anual com desconto) + simulação de ROI."
      : ctx.stage === "pronto"
      ? "\n\nSe você já estiver pronto, eu te mando agora a proposta + link de pagamento e já deixo o onboarding agendado."
      : ctx.stage === "cético"
      ? "\n\nSe você quiser, eu te mostro 2 cases e fazemos um teste rápido com suporte humano junto (pra não ficar robótico)."
      : "";

  const closing =
    ctx.channel === "whatsapp"
      ? "\n\nMe diz: qual seu segmento e quantos leads/mês vocês recebem hoje?"
      : "\n\nMe passa seu contexto (segmento e volume) que eu te respondo com números.";

  return `${opener}\n\nVocê perguntou: "${input}"${hint}${stageLine}${closing}`;
}
