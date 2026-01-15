import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Save,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  BookOpen,
  TestTube2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Upload,
  Download,
  FileText,
  Sparkles,
  Copy,
  Play,
  MessageSquare,
  Zap,
  Target,
  Users,
  TrendingUp,
  X,
  Edit3,
  BarChart3,
  Clock,
  Send,
  Star,
  Quote,
  Award,
  ToggleLeft,
  ToggleRight,
  ImageIcon,
  User,
} from "lucide-react";

// ============ TYPES ============

type KnowledgeItem = {
  id?: string;
  question: string;
  answer: string;
  category?: string | null;
  priority?: number | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
};

type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
};

type SocialProof = {
  id: string;
  type: "depoimento" | "case" | "metrica";
  title: string;
  content: string;
  author?: string;
  company?: string;
  result?: string;
  image?: string; // URL da imagem
  active: boolean;
  created_at?: string;
};

// ============ PROMPT TEMPLATES ============

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "vendas",
    name: "Vendas Consultivas",
    description: "Foco em entender necessidades e fechar com valor",
    tags: ["vendas", "consultivo"],
    prompt: `Você é um especialista em vendas consultivas da DOCA AI.

OBJETIVO: Entender as necessidades do lead e guiá-lo para uma decisão de compra.

REGRAS:
- Nunca seja agressivo ou pushy
- Faça perguntas para entender o contexto
- Apresente benefícios, não features
- Use prova social quando apropriado
- Crie urgência genuína, não artificial

TOM DE VOZ:
- Profissional mas humano
- Empático e consultivo
- Direto ao ponto
- Sem emojis excessivos

ESTRUTURA DE RESPOSTA:
1. Reconheça a dúvida/necessidade
2. Responda de forma clara
3. Faça uma pergunta de qualificação OU apresente próximo passo`,
  },
  {
    id: "suporte",
    name: "Suporte ao Cliente",
    description: "Resolver problemas com empatia e eficiência",
    tags: ["suporte", "atendimento"],
    prompt: `Você é um especialista em suporte da DOCA AI.

OBJETIVO: Resolver problemas rapidamente mantendo o cliente satisfeito.

REGRAS:
- Priorize resolver o problema
- Se não souber, escale para humano
- Nunca invente informações
- Documente o problema para melhoria

TOM DE VOZ:
- Empático e paciente
- Técnico quando necessário
- Sempre ofereça alternativas

ESTRUTURA:
1. Reconheça o problema
2. Apresente a solução
3. Confirme se resolveu`,
  },
  {
    id: "qualificacao",
    name: "Qualificação de Leads",
    description: "Identificar leads qualificados rapidamente",
    tags: ["vendas", "qualificação"],
    prompt: `Você é um especialista em qualificação de leads da DOCA AI.

OBJETIVO: Identificar se o lead tem fit com nossa solução.

CRITÉRIOS DE QUALIFICAÇÃO:
- Budget: Tem orçamento para investir?
- Authority: É o decisor?
- Need: Tem uma dor real que resolvemos?
- Timeline: Precisa resolver em quanto tempo?

PERGUNTAS CHAVE:
- Qual seu maior desafio hoje em [área]?
- Quantos leads/mês vocês recebem?
- Quem mais participa da decisão?
- Qual prazo ideal para implementar?

TOM: Curioso, consultivo, sem pressão.`,
  },
  {
    id: "reativacao",
    name: "Reativação de Leads",
    description: "Reengajar leads frios com valor",
    tags: ["nutrição", "reativação"],
    prompt: `Você é especialista em reativação de leads da DOCA AI.

OBJETIVO: Reengajar leads que esfriaram oferecendo valor.

ESTRATÉGIAS:
- Compartilhe novidades relevantes
- Ofereça conteúdo educativo
- Mencione cases de sucesso recentes
- Crie FOMO genuíno

NUNCA:
- Seja invasivo ou repetitivo
- Pressione por resposta
- Ignore o contexto anterior

TOM: Amigável, informativo, sem cobrança.`,
  },
];

// ============ API HELPERS ============

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getAgentPrompt(tenantId?: string | null): Promise<string> {
  try {
    const url = tenantId ? `/api/settings?key=agent_prompt&tenant_id=${tenantId}` : "/api/settings?key=agent_prompt";
    const data = await fetchJson<{ value: string }>(url);
    return data?.value || "";
  } catch {
    return "";
  }
}

async function saveAgentPrompt(value: string, tenantId?: string | null): Promise<void> {
  await fetchJson("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "agent_prompt", value, tenant_id: tenantId }),
  });
}

async function getKnowledge(tenantId?: string | null): Promise<KnowledgeItem[]> {
  try {
    const url = tenantId ? `/api/knowledge?tenant_id=${tenantId}` : "/api/knowledge";
    const data = await fetchJson<KnowledgeItem[]>(url);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveKnowledge(item: KnowledgeItem, tenantId?: string | null): Promise<void> {
  await fetchJson("/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...item, tenant_id: tenantId }),
  });
}

async function deleteKnowledge(id: string, tenantId?: string | null): Promise<void> {
  await fetchJson("/api/knowledge", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, tenant_id: tenantId }),
  });
}

// ============ MAIN COMPONENT ============

type Props = { tenantId?: string | null };

export default function TrainingPage({ tenantId }: Props) {
  const [tab, setTab] = useState<"prompt" | "knowledge" | "social" | "playground">("prompt");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Prompt state
  const [prompt, setPrompt] = useState("");
  const [promptOriginal, setPromptOriginal] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptSaving, setPromptSaving] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);

  // Knowledge state
  const [kb, setKb] = useState<KnowledgeItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbSearch, setKbSearch] = useState("");
  const [kbCategory, setKbCategory] = useState("all");
  const [kbModal, setKbModal] = useState(false);
  const [kbEditing, setKbEditing] = useState<KnowledgeItem | null>(null);
  const [kbSaving, setKbSaving] = useState(false);
  const [importModal, setImportModal] = useState(false);

  // Social Proof state
  const [socialProofs, setSocialProofs] = useState<SocialProof[]>([
    {
      id: "sp-1",
      type: "depoimento",
      title: "Atendimento 24/7",
      content: "Depois que implementamos a DOCA, nosso atendimento nunca mais parou. Os clientes adoram a rapidez!",
      author: "Maria Silva",
      company: "Clínica Estética",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "sp-2",
      type: "case",
      title: "Aumento de 40% em conversões",
      content: "Restaurante que triplicou pedidos pelo WhatsApp usando IA para atendimento automático.",
      result: "+40% conversão em 30 dias",
      company: "Pizzaria Napolitana",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "sp-3",
      type: "metrica",
      title: "Tempo de resposta",
      content: "Média de 8 segundos para primeira resposta, contra 15 minutos do atendimento manual.",
      result: "8s vs 15min",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=200&fit=crop",
      active: true,
      created_at: new Date().toISOString(),
    },
  ]);
  const [socialModal, setSocialModal] = useState(false);
  const [socialEditing, setSocialEditing] = useState<SocialProof | null>(null);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialFilter, setSocialFilter] = useState<"all" | "depoimento" | "case" | "metrica">("all");

  // Playground state
  const [playInput, setPlayInput] = useState("");
  const [playOutput, setPlayOutput] = useState("");
  const [playLoading, setPlayLoading] = useState(false);
  const [playHistory, setPlayHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  // ============ LOAD DATA ============

  useEffect(() => {
    loadPrompt();
    loadKb();
  }, [tenantId]);

  async function loadPrompt() {
    setPromptLoading(true);
    const p = await getAgentPrompt(tenantId);
    setPrompt(p);
    setPromptOriginal(p);
    setPromptLoading(false);
  }

  async function loadKb() {
    setKbLoading(true);
    const data = await getKnowledge(tenantId);
    setKb(data);
    setKbLoading(false);
  }

  // ============ PROMPT ACTIONS ============

  async function handleSavePrompt() {
    if (!prompt.trim()) {
      showToast("error", "Prompt vazio");
      return;
    }
    setPromptSaving(true);
    try {
      await saveAgentPrompt(prompt, tenantId);
      setPromptOriginal(prompt);
      showToast("success", "Prompt salvo!");
    } catch {
      showToast("error", "Erro ao salvar");
    }
    setPromptSaving(false);
  }

  function handleUseTemplate(t: PromptTemplate) {
    setPrompt(t.prompt);
    setTemplateModal(false);
    showToast("success", `Template "${t.name}" aplicado`);
  }

  // ============ KB ACTIONS ============

  const categories = useMemo(() => {
    const cats = new Set<string>();
    kb.forEach(k => k.category && cats.add(k.category));
    return ["all", ...Array.from(cats).sort()];
  }, [kb]);

  const filteredKb = useMemo(() => {
    const q = kbSearch.toLowerCase();
    return kb.filter(k => {
      if (kbCategory !== "all" && k.category !== kbCategory) return false;
      if (!q) return true;
      return `${k.question} ${k.answer} ${(k.tags || []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [kb, kbSearch, kbCategory]);

  const kbStats = useMemo(() => ({
    total: kb.length,
    categories: new Set(kb.map(k => k.category).filter(Boolean)).size,
    avgPriority: kb.length > 0 ? (kb.reduce((a, k) => a + (k.priority || 3), 0) / kb.length).toFixed(1) : "0",
  }), [kb]);

  async function handleSaveKb(item: KnowledgeItem) {
    if (!item.question?.trim() || !item.answer?.trim()) {
      showToast("error", "Pergunta e resposta obrigatórias");
      return;
    }
    setKbSaving(true);
    try {
      await saveKnowledge(item, tenantId);
      showToast("success", item.id ? "Atualizado!" : "Adicionado!");
      setKbModal(false);
      setKbEditing(null);
      await loadKb();
    } catch {
      showToast("error", "Erro ao salvar");
    }
    setKbSaving(false);
  }

  async function handleDeleteKb(id: string) {
    if (!confirm("Remover este item?")) return;
    try {
      await deleteKnowledge(id, tenantId);
      showToast("success", "Removido!");
      await loadKb();
    } catch {
      showToast("error", "Erro ao remover");
    }
  }

  // ============ IMPORT/EXPORT ============

  function handleExportKb() {
    const data = kb.map(({ id, question, answer, category, priority, tags }) => ({
      question, answer, category, priority, tags
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-base-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    showToast("success", "Exportado!");
  }

  function handleImportKb(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) throw new Error("Formato inválido");
        
        let imported = 0;
        for (const item of data) {
          if (item.question && item.answer) {
            await saveKnowledge({
              question: item.question,
              answer: item.answer,
              category: item.category || null,
              priority: item.priority || 3,
              tags: item.tags || [],
            }, tenantId);
            imported++;
          }
        }
        showToast("success", `${imported} itens importados!`);
        await loadKb();
        setImportModal(false);
      } catch {
        showToast("error", "Erro ao importar arquivo");
      }
    };
    reader.readAsText(file);
  }

  // ============ PLAYGROUND ============

  async function handlePlayground() {
    if (!playInput.trim()) return;
    
    setPlayLoading(true);
    setPlayHistory(prev => [...prev, { role: "user", text: playInput }]);
    
    // Simula busca na KB + resposta
    await new Promise(r => setTimeout(r, 800));
    
    const q = playInput.toLowerCase();
    const matches = kb.filter(k => 
      k.question.toLowerCase().includes(q) || 
      k.answer.toLowerCase().includes(q) ||
      (k.tags || []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 2);
    
    let response = "";
    if (matches.length > 0) {
      response = `Baseado na base de conhecimento:\n\n${matches[0].answer}`;
      if (matches.length > 1) {
        response += `\n\nTambém relacionado: ${matches[1].question}`;
      }
    } else {
      response = "Não encontrei uma resposta específica na base de conhecimento. Considere adicionar esse tópico ao KB ou escalar para humano.";
    }
    
    setPlayHistory(prev => [...prev, { role: "ai", text: response }]);
    setPlayOutput(response);
    setPlayInput("");
    setPlayLoading(false);
  }

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-[#f57f17]" />
            Treinamento
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Configure o comportamento e conhecimento do agente
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "prompt", label: "Prompt", icon: FileText },
            { key: "knowledge", label: "Base de Conhecimento", icon: BookOpen },
            { key: "social", label: "Prova Social", icon: Star },
            { key: "playground", label: "Playground", icon: TestTube2 },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-[#f57f17]/20 border border-[#f57f17]/30 text-white"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* PROMPT TAB */}
      {tab === "prompt" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={FileText} label="Caracteres" value={prompt.length.toLocaleString()} />
            <StatCard icon={Target} label="Linhas" value={prompt.split("\n").length} />
            <StatCard icon={Clock} label="Status" value={prompt === promptOriginal ? "Salvo" : "Alterado"} 
              color={prompt === promptOriginal ? "text-emerald-400" : "text-yellow-400"} />
          </div>

          {/* Editor */}
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-bold">System Prompt</h3>
                <p className="text-gray-500 text-sm">Define personalidade, regras e tom de voz do agente</p>
              </div>
              <button
                onClick={() => setTemplateModal(true)}
                className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Templates
              </button>
            </div>

            {promptLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
              </div>
            ) : (
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full h-80 bg-black/30 border border-white/10 rounded-xl p-4 text-gray-200 text-sm font-mono resize-none outline-none focus:border-[#f57f17]/50"
                placeholder="Digite o system prompt do agente..."
              />
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                {prompt !== promptOriginal && "Alterações não salvas"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrompt(promptOriginal)}
                  disabled={prompt === promptOriginal}
                  className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restaurar
                </button>
                <button
                  onClick={handleSavePrompt}
                  disabled={promptSaving || prompt === promptOriginal}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {promptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KNOWLEDGE TAB */}
      {tab === "knowledge" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={BookOpen} label="Total de FAQs" value={kbStats.total} />
            <StatCard icon={BarChart3} label="Categorias" value={kbStats.categories} />
            <StatCard icon={Target} label="Prioridade Média" value={kbStats.avgPriority} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={kbSearch}
                  onChange={e => setKbSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="h-10 pl-10 pr-4 w-64 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 outline-none"
                />
              </div>
              <select
                value={kbCategory}
                onChange={e => setKbCategory(e.target.value)}
                className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c} className="bg-black">
                    {c === "all" ? "Todas categorias" : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportModal(true)}
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar
              </button>
              <button
                onClick={handleExportKb}
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
              <button
                onClick={() => { setKbEditing(null); setKbModal(true); }}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          </div>

          {/* List */}
          <div className="rounded-[28px] border border-white/10 bg-white/5 overflow-hidden">
            {kbLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
              </div>
            ) : filteredKb.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                <BookOpen className="w-8 h-8 mb-2" />
                <p>Nenhum item encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredKb.map(item => (
                  <div key={item.id} className="p-4 hover:bg-white/5 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{item.question}</p>
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.answer}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {item.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f57f17]/10 text-[#f57f17]">
                              {item.category}
                            </span>
                          )}
                          {item.priority && (
                            <span className="text-xs text-gray-500">P{item.priority}</span>
                          )}
                          {(item.tags || []).slice(0, 3).map(t => (
                            <span key={t} className="text-xs text-gray-600">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setKbEditing(item); setKbModal(true); }}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        >
                          <Edit3 className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => item.id && handleDeleteKb(item.id)}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOCIAL PROOF TAB */}
      {tab === "social" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Star} label="Total" value={socialProofs.length} />
            <StatCard icon={Quote} label="Depoimentos" value={socialProofs.filter(s => s.type === "depoimento").length} />
            <StatCard icon={Award} label="Cases" value={socialProofs.filter(s => s.type === "case").length} />
            <StatCard icon={TrendingUp} label="Métricas" value={socialProofs.filter(s => s.type === "metrica").length} />
          </div>

          {/* Info */}
          <div className="rounded-[28px] border border-[#f57f17]/20 bg-[#f57f17]/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#f57f17] mt-0.5" />
              <div>
                <h4 className="text-white font-semibold">Como funciona a Prova Social</h4>
                <p className="text-sm text-gray-400 mt-1">
                  O agente usa essas informações para gerar confiança durante a conversa. 
                  Depoimentos, cases e métricas são inseridos automaticamente quando relevante.
                </p>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {(["all", "depoimento", "case", "metrica"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSocialFilter(f)}
                  className={`h-9 px-3 rounded-lg text-sm font-medium transition ${
                    socialFilter === f
                      ? "bg-[#f57f17]/20 text-white"
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "depoimento" ? "Depoimentos" : f === "case" ? "Cases" : "Métricas"}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setSocialEditing(null); setSocialModal(true); }}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {socialProofs
              .filter(s => socialFilter === "all" || s.type === socialFilter)
              .map(item => (
                <div
                  key={item.id}
                  className={`rounded-[20px] border overflow-hidden transition ${
                    item.active
                      ? "border-white/10 bg-white/5"
                      : "border-white/5 bg-white/[0.02] opacity-50"
                  }`}
                >
                  {/* Imagem do case/métrica (horizontal no topo) */}
                  {item.image && item.type !== "depoimento" && (
                    <div className="h-32 w-full overflow-hidden bg-black/20">
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Foto do autor (depoimento) - circular */}
                      {item.type === "depoimento" && (
                        <div className="flex-shrink-0">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.author || "Cliente"}
                              className="w-14 h-14 rounded-full object-cover border-2 border-white/10"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-purple-500/20 border-2 border-purple-500/30 flex items-center justify-center">
                              <User className="w-6 h-6 text-purple-400" />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            item.type === "depoimento" ? "bg-purple-500/20 text-purple-300" :
                            item.type === "case" ? "bg-emerald-500/20 text-emerald-300" :
                            "bg-blue-500/20 text-blue-300"
                          }`}>
                            {item.type === "depoimento" ? "Depoimento" : item.type === "case" ? "Case" : "Métrica"}
                          </span>
                          {!item.active && (
                            <span className="text-xs text-gray-500">Inativo</span>
                          )}
                        </div>

                        <h4 className="text-white font-semibold">{item.title}</h4>
                        
                        {item.type === "depoimento" ? (
                          <p className="text-sm text-gray-300 mt-2 italic">"{item.content}"</p>
                        ) : (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                        )}

                        {(item.author || item.company) && (
                          <p className="text-xs text-gray-500 mt-2">
                            {item.author && <span className="font-medium text-gray-400">{item.author}</span>}
                            {item.author && item.company && <span> • </span>}
                            {item.company && <span>{item.company}</span>}
                          </p>
                        )}

                        {item.result && (
                          <div className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-sm text-emerald-300 font-bold">{item.result}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSocialProofs(prev => prev.map(s => 
                              s.id === item.id ? { ...s, active: !s.active } : s
                            ));
                          }}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                          title={item.active ? "Desativar" : "Ativar"}
                        >
                          {item.active ? (
                            <ToggleRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => { setSocialEditing(item); setSocialModal(true); }}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        >
                          <Edit3 className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Remover este item?")) {
                              setSocialProofs(prev => prev.filter(s => s.id !== item.id));
                            }
                          }}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {socialProofs.filter(s => socialFilter === "all" || s.type === socialFilter).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma prova social encontrada</p>
            </div>
          )}
        </div>
      )}

      {/* PLAYGROUND TAB */}
      {tab === "playground" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat */}
          <div className="rounded-[28px] border border-white/10 bg-white/5 flex flex-col h-[600px]">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#f57f17]" />
                Testar Agente
              </h3>
              <p className="text-gray-500 text-sm">Simule conversas para validar respostas</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {playHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <TestTube2 className="w-8 h-8 mb-2" />
                  <p>Envie uma mensagem para testar</p>
                </div>
              ) : (
                playHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === "user" 
                        ? "bg-[#f57f17]/20 text-white" 
                        : "bg-white/5 border border-white/10 text-gray-200"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {playLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={playInput}
                  onChange={e => setPlayInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handlePlayground()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 h-11 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                />
                <button
                  onClick={handlePlayground}
                  disabled={playLoading || !playInput.trim()}
                  className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setPlayHistory([])}
                className="mt-2 text-xs text-gray-500 hover:text-gray-400"
              >
                Limpar conversa
              </button>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <h3 className="text-white font-bold mb-4">Como funciona</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <p>1. O playground busca na Base de Conhecimento</p>
                <p>2. Se encontrar match, usa a resposta cadastrada</p>
                <p>3. Se não encontrar, sugere adicionar ao KB</p>
                <p>4. Em produção, usa o prompt + Claude API</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <h3 className="text-white font-bold mb-4">Sugestões de teste</h3>
              <div className="space-y-2">
                {["Quanto custa?", "Como funciona?", "Vocês têm suporte?", "Qual o prazo?"].map(q => (
                  <button
                    key={q}
                    onClick={() => setPlayInput(q)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h3 className="text-emerald-300 font-bold mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Dica
              </h3>
              <p className="text-sm text-gray-400">
                Adicione perguntas frequentes ao KB para melhorar a qualidade das respostas automáticas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Template Modal */}
      {templateModal && (
        <Modal title="Templates de Prompt" onClose={() => setTemplateModal(false)}>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {PROMPT_TEMPLATES.map(t => (
              <div key={t.id} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{t.name}</p>
                    <p className="text-gray-500 text-sm mt-1">{t.description}</p>
                    <div className="flex gap-1 mt-2">
                      {t.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUseTemplate(t)}
                    className="h-8 px-3 rounded-lg bg-[#f57f17]/20 text-[#f57f17] text-sm font-medium"
                  >
                    Usar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* KB Modal */}
      {kbModal && (
        <KbModal
          item={kbEditing}
          saving={kbSaving}
          onClose={() => { setKbModal(false); setKbEditing(null); }}
          onSave={handleSaveKb}
        />
      )}

      {/* Import Modal */}
      {importModal && (
        <Modal title="Importar Base de Conhecimento" onClose={() => setImportModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Importe um arquivo JSON com array de objetos contendo: question, answer, category, priority, tags
            </p>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center">
              <input
                type="file"
                accept=".json"
                onChange={e => e.target.files?.[0] && handleImportKb(e.target.files[0])}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">Clique para selecionar arquivo</p>
                <p className="text-xs text-gray-600 mt-1">.json</p>
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* Social Proof Modal */}
      {socialModal && (
        <SocialProofModal
          item={socialEditing}
          saving={socialSaving}
          onClose={() => { setSocialModal(false); setSocialEditing(null); }}
          onSave={(item) => {
            setSocialSaving(true);
            setTimeout(() => {
              if (item.id) {
                setSocialProofs(prev => prev.map(s => s.id === item.id ? item : s));
              } else {
                setSocialProofs(prev => [...prev, { ...item, id: `sp-${Date.now()}`, created_at: new Date().toISOString() }]);
              }
              setSocialModal(false);
              setSocialEditing(null);
              setSocialSaving(false);
              showToast("success", item.id ? "Atualizado!" : "Adicionado!");
            }, 300);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-xl flex items-center gap-2 ${
          toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" :
          "bg-red-500/20 border border-red-500/30 text-red-300"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color || "text-white"}`}>{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KbModal({ item, saving, onClose, onSave }: { 
  item: KnowledgeItem | null; 
  saving: boolean; 
  onClose: () => void; 
  onSave: (item: KnowledgeItem) => void;
}) {
  const [question, setQuestion] = useState(item?.question || "");
  const [answer, setAnswer] = useState(item?.answer || "");
  const [category, setCategory] = useState(item?.category || "");
  const [priority, setPriority] = useState(item?.priority || 3);
  const [tags, setTags] = useState((item?.tags || []).join(", "));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">{item?.id ? "Editar FAQ" : "Nova FAQ"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Pergunta</label>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
              placeholder="Ex: Quanto custa o plano?"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Resposta</label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              className="w-full h-32 mt-1 p-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
              placeholder="Ex: Temos planos a partir de R$ 297/mês..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">Categoria</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                placeholder="Preço"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Prioridade</label>
              <select
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
              >
                {[1,2,3,4,5].map(n => <option key={n} value={n} className="bg-black">{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Tags (vírgula)</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                placeholder="preço, plano"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
            Cancelar
          </button>
          <button
            onClick={() => onSave({
              id: item?.id,
              question,
              answer,
              category: category || null,
              priority,
              tags: tags.split(",").map(t => t.trim()).filter(Boolean),
            })}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialProofModal({ item, saving, onClose, onSave }: { 
  item: SocialProof | null; 
  saving: boolean; 
  onClose: () => void; 
  onSave: (item: SocialProof) => void;
}) {
  const [type, setType] = useState<SocialProof["type"]>(item?.type || "depoimento");
  const [title, setTitle] = useState(item?.title || "");
  const [content, setContent] = useState(item?.content || "");
  const [author, setAuthor] = useState(item?.author || "");
  const [company, setCompany] = useState(item?.company || "");
  const [result, setResult] = useState(item?.result || "");
  const [image, setImage] = useState(item?.image || "");
  const [active, setActive] = useState(item?.active ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">{item?.id ? "Editar Prova Social" : "Nova Prova Social"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Tipo</label>
            <div className="flex gap-2">
              {([
                { key: "depoimento", label: "Depoimento", icon: Quote },
                { key: "case", label: "Case de Sucesso", icon: Award },
                { key: "metrica", label: "Métrica", icon: TrendingUp },
              ] as const).map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition ${
                    type === t.key
                      ? "bg-[#f57f17]/20 border border-[#f57f17]/30 text-white"
                      : "bg-white/5 border border-white/10 text-gray-400"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Imagem */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              {type === "depoimento" ? "Foto do Cliente" : "Imagem/Print"}
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                  placeholder="Cole a URL da imagem..."
                />
                <p className="text-xs text-gray-600 mt-1">
                  {type === "depoimento" 
                    ? "Foto do cliente para aparecer junto ao depoimento"
                    : "Print de resultado, gráfico ou imagem ilustrativa"
                  }
                </p>
              </div>
              
              {/* Preview */}
              <div className={`flex-shrink-0 ${type === "depoimento" ? "w-16 h-16" : "w-24 h-16"} rounded-xl border border-white/10 bg-black/30 overflow-hidden flex items-center justify-center`}>
                {image ? (
                  <img 
                    src={image} 
                    alt="Preview"
                    className={`w-full h-full object-cover ${type === "depoimento" ? "rounded-full" : ""}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-600" />
                )}
              </div>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs text-gray-500">Título</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
              placeholder="Ex: Aumento de 40% em conversões"
            />
          </div>

          {/* Conteúdo */}
          <div>
            <label className="text-xs text-gray-500">
              {type === "depoimento" ? "Depoimento" : type === "case" ? "Descrição do Case" : "Descrição da Métrica"}
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full h-24 mt-1 p-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
              placeholder={
                type === "depoimento" 
                  ? "Ex: Depois que implementamos a DOCA, nosso atendimento nunca mais parou..."
                  : type === "case"
                  ? "Ex: Restaurante que triplicou pedidos pelo WhatsApp..."
                  : "Ex: Tempo médio de resposta reduziu de 15min para 8 segundos"
              }
            />
          </div>

          {/* Campos condicionais */}
          <div className="grid grid-cols-2 gap-4">
            {type === "depoimento" && (
              <div>
                <label className="text-xs text-gray-500">Autor</label>
                <input
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                  placeholder="Ex: Maria Silva"
                />
              </div>
            )}
            
            <div>
              <label className="text-xs text-gray-500">Empresa</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                placeholder="Ex: Clínica Estética"
              />
            </div>

            {(type === "case" || type === "metrica") && (
              <div>
                <label className="text-xs text-gray-500">Resultado</label>
                <input
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                  placeholder="Ex: +40% conversão em 30 dias"
                />
              </div>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-sm text-white font-medium">Ativo</p>
              <p className="text-xs text-gray-500">Disponível para o agente usar</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`h-8 w-14 rounded-full transition ${active ? "bg-emerald-500" : "bg-gray-600"}`}
            >
              <div className={`h-6 w-6 rounded-full bg-white transition transform ${active ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
            Cancelar
          </button>
          <button
            onClick={() => onSave({
              id: item?.id || "",
              type,
              title,
              content,
              author: author || undefined,
              company: company || undefined,
              result: result || undefined,
              image: image || undefined,
              active,
              created_at: item?.created_at,
            })}
            disabled={saving || !title.trim() || !content.trim()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}