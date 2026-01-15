import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Search,
  Copy,
  Wand2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  X,
  CheckCircle2,
  Target,
  Zap,
  ChevronRight,
  Phone,
} from "lucide-react";

import { isDemoMode, getDemoData } from "../mock";

// ============ TYPES ============

type Conv = {
  id: string;
  lead_id?: string;
  phone?: string;
  name?: string | null;
  status?: string;
  updated_at?: string;
  created_at?: string;
  last_message?: string;
  current_emotion?: string;
  temperature?: number;
  tags?: string[];
};

type Msg = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent" | string;
  text: string;
  created_at: string;
};

type Lead = {
  id: string;
  phone: string;
  name?: string | null;
  health_score?: number;
  stage?: string;
  urgency_level?: "low" | "normal" | "high" | "critical" | string;
  conversion_probability?: number;
  tags?: string[];
  updated_at?: string;
  score?: number;
  status?: string;
};

type FollowUp = {
  id: string;
  title: string;
  goal: string;
  timing: string;
  text: string;
  confidence: number;
  stage: string;
};

type Props = {
  tenantId?: string | null;
  conversations?: any[];
  leads?: any[];
  onSendFollowUp?: (lead: any, message: string) => void;
  onOpenConversation?: (lead: any) => void;
};

// ============ HELPERS ============

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function fmtPhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function emotionLabel(e?: string) {
  const m: Record<string, string> = {
    ready: "Pronto", excited: "Empolgado", curious: "Curioso",
    skeptical: "Cético", frustrated: "Frustrado", price_sensitive: "Preço", neutral: "Neutro",
  };
  return m[e || ""] || e || "—";
}

function stageLabel(s?: string) {
  const m: Record<string, string> = {
    pronto: "Pronto", empolgado: "Empolgado", curioso: "Curioso",
    "sensível_preço": "Preço", cético: "Cético", frustrado: "Frustrado",
  };
  return m[s || ""] || s || "—";
}

// ============ FOLLOW-UP GENERATOR ============

function generateFollowUps(lead: Lead | null, conv: Conv | null, messages: Msg[]): FollowUp[] {
  const name = lead?.name || conv?.name || "aí";
  const stage = (lead?.stage || conv?.current_emotion || "curioso").toLowerCase();
  const urg = lead?.urgency_level || "normal";
  const isUrgent = urg === "high" || urg === "critical";

  const openers = [`Oi ${name}!`, `Fala ${name}!`, `Olá ${name}!`, `E aí ${name}!`];
  const opener = openers[Math.floor(Math.random() * openers.length)];

  const followups: FollowUp[] = [];

  // Baseado no estágio
  if (stage.includes("pronto") || stage.includes("ready")) {
    followups.push({
      id: "fu-1",
      title: "Fechamento direto",
      goal: "Encaminhar contrato/pagamento",
      timing: "Agora",
      confidence: 0.92,
      stage: "fechamento",
      text: `${opener} Perfeito! Pra fechar hoje, preciso de: 1) plano (mensal/anual) e 2) CNPJ ou CPF pro contrato. Te mando o link assim que confirmar.`,
    });
    followups.push({
      id: "fu-2",
      title: "Onboarding rápido",
      goal: "Reduzir atrito pós-venda",
      timing: "Após pagamento",
      confidence: 0.85,
      stage: "fechamento",
      text: `${opener} Assim que confirmar, já te mando o checklist do onboarding (leva 15min) e ativamos a IA com seu tom de voz.`,
    });
  } else if (stage.includes("cético") || stage.includes("skept")) {
    followups.push({
      id: "fu-1",
      title: "Prova social + teste",
      goal: "Gerar confiança",
      timing: isUrgent ? "Agora" : "Em 4h",
      confidence: 0.88,
      stage: "objeções",
      text: `${opener} Totalmente justo ser pé no chão. Pra não ficar no "achismo", te mostro 2 cases reais e fazemos um teste assistido. Qual seu maior receio: ficar robótico, errar info ou não converter?`,
    });
    followups.push({
      id: "fu-2",
      title: "Demo rápida",
      goal: "Mostrar tom humano na prática",
      timing: "Em 1 dia",
      confidence: 0.78,
      stage: "objeções",
      text: `${opener} Se topar, faço uma demo em 10min com um exemplo real seu (uma objeção comum do seu cliente) e você vê funcionando.`,
    });
  } else if (stage.includes("preço") || stage.includes("price")) {
    followups.push({
      id: "fu-1",
      title: "Ancorar ROI",
      goal: "Converter objeção de preço em valor",
      timing: isUrgent ? "Agora" : "Em 2h",
      confidence: 0.86,
      stage: "valor",
      text: `${opener} Vi que você está comparando preço. Pra ficar justo: com seu volume, a DOCA normalmente reduz tempo de resposta e aumenta conversão. Quantos leads/mês e quantos atendentes hoje? Simulo o ROI rapidinho.`,
    });
    followups.push({
      id: "fu-2",
      title: "2 opções de pagamento",
      goal: "Dar escolha e remover atrito",
      timing: "Em 1 dia",
      confidence: 0.80,
      stage: "valor",
      text: `${opener} Pra facilitar: 1) mensal (flexível) e 2) anual (com desconto). Quer que eu mande as duas opções?`,
    });
  } else if (stage.includes("frustr")) {
    followups.push({
      id: "fu-1",
      title: "Reparação + prioridade",
      goal: "Desarmar tensão",
      timing: "Agora",
      confidence: 0.90,
      stage: "objeções",
      text: `${opener} Você tem razão, isso não é experiência aceitável. Vou priorizar seu caso agora. Me diz em 1 frase o que precisa resolver primeiro.`,
    });
  } else {
    // Curioso / padrão
    followups.push({
      id: "fu-1",
      title: "Qualificação rápida",
      goal: "Entender contexto",
      timing: isUrgent ? "Agora" : "Em 2h",
      confidence: 0.86,
      stage: "valor",
      text: `${opener} Pra te orientar certo: 1) qual seu tipo de negócio? 2) quantos leads/mês? 3) qual seu maior gargalo hoje?`,
    });
    followups.push({
      id: "fu-2",
      title: "Agendamento",
      goal: "Mover para call",
      timing: "Em 1 dia",
      confidence: 0.75,
      stage: "fechamento",
      text: `${opener} Se preferir, a gente resolve em uma call curta. Você prefere às 09:30 ou 10:00?`,
    });
  }

  // Nutrição (sempre adiciona)
  followups.push({
    id: "fu-nurt",
    title: "Reativação leve",
    goal: "Retomar contato",
    timing: "Em 2 dias",
    confidence: 0.72,
    stage: "nutrição",
    text: `Oi! Passando rapidinho pra saber se ficou alguma dúvida. Se fizer sentido, te mando os próximos passos em 1 minuto.`,
  });

  return followups;
}

// ============ COMPONENT ============

export default function AIAnalysisPage(props: Props) {
  const demoMode = isDemoMode();
  const demo = useMemo(() => (demoMode ? getDemoData() : null), [demoMode]);

  const tenantId = props.tenantId;
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conv | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Modal de envio
  const [sendModal, setSendModal] = useState<{ lead: Lead; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Lead selecionado
  const selectedLead = useMemo(() => {
    if (!selectedConv) return null;
    const phone = (selectedConv.phone || "").replace("@c.us", "");
    return leads.find(l => l.phone.replace("@c.us", "") === phone || l.id === selectedConv.lead_id) || null;
  }, [selectedConv, leads]);

  // ============ LOAD DATA ============

  async function loadData() {
    setLoading(true);
    try {
      if (demoMode && demo) {
        setConversations(demo.conversations || []);
        setLeads(demo.leads || []);
        const first = demo.conversations?.[0] || null;
        setSelectedConv(first);
        if (first) {
          const msgs = (demo.messages || []).filter((m: any) => m.conversation_id === first.id);
          setMessages(msgs);
          setFollowups(generateFollowUps(null, first, msgs));
        }
        setLoading(false);
        return;
      }

      // Real mode - ✅ USA tenantId
      const convUrl = tenantId 
        ? `/api/conversations?limit=100&tenant_id=${tenantId}`
        : `/api/conversations?limit=100`;
      const convRes = await fetch(convUrl);
      const convs = await convRes.json();
      const mappedConvs: Conv[] = (convs || []).map((c: any) => ({
        id: c.id,
        lead_id: c.lead_id,
        phone: c.phone || c.chat_id || "",
        name: c.name,
        status: c.status,
        updated_at: c.updated_at,
        created_at: c.created_at,
        last_message: c.last_message,
        current_emotion: c.current_emotion,
        temperature: c.temperature,
        tags: c.tags || [],
      }));
      setConversations(mappedConvs);

      // ✅ USA tenantId
      const leadsUrl = tenantId
        ? `/api/leads?limit=200&tenant_id=${tenantId}`
        : `/api/leads?limit=200`;
      const leadsRes = await fetch(leadsUrl);
      const ls = await leadsRes.json();
      const mappedLeads: Lead[] = (ls || []).map((l: any) => ({
        id: l.id,
        phone: (l.phone || "").replace("@c.us", ""),
        name: l.name,
        health_score: l.health_score ?? l.score ?? 50,
        stage: l.stage ?? "curioso",
        urgency_level: l.urgency_level ?? "normal",
        conversion_probability: l.conversion_probability ?? 0.4,
        tags: l.tags || [],
        updated_at: l.updated_at,
      }));
      setLeads(mappedLeads);

      const first = mappedConvs[0] || null;
      setSelectedConv(first);
      if (first) await loadMessages(first);
      
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function loadMessages(conv: Conv) {
    setSelectedConv(conv);
    setMessages([]);
    setFollowups([]);

    try {
      if (demoMode && demo) {
        const msgs = (demo.messages || []).filter((m: any) => m.conversation_id === conv.id);
        setMessages(msgs);
        const lead = leads.find(l => l.id === conv.lead_id) || null;
        setFollowups(generateFollowUps(lead, conv, msgs));
        return;
      }

      const res = await fetch(`/api/messages?conversation_id=${encodeURIComponent(conv.id)}&limit=50`);
      const data = await res.json();
      const mapped: Msg[] = (data || []).map((m: any) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        from: m.role === "user" ? "lead" : m.role === "assistant" ? "agent" : (m.from || "lead"),
        text: m.content || m.text || "",
        created_at: m.timestamp || m.created_at || new Date().toISOString(),
      }));
      setMessages(mapped);
      
      const lead = leads.find(l => l.phone.replace("@c.us", "") === (conv.phone || "").replace("@c.us", "")) || null;
      setFollowups(generateFollowUps(lead, conv, mapped));
    } catch (e) {
      console.error(e);
    }
  }

  // ✅ Recarrega quando tenantId mudar
  useEffect(() => { loadData(); }, [tenantId]);

  // ============ FILTERED CONVS ============

  const filteredConvs = useMemo(() => {
    // Filtra conversas inválidas (broadcast, lid, grupos, landing, sessões)
    const valid = conversations.filter(c => {
      const phone = (c.phone || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      
      // Filtros de exclusão
      if (phone.includes("@broadcast")) return false;
      if (phone.includes("@lid")) return false;
      if (phone.includes("@g.us")) return false;
      if (phone.includes("status@broadcast")) return false;
      if (phone.includes("landing:")) return false;
      if (name.includes("landing:")) return false;
      if (phone.includes("sess_")) return false;
      if (name.includes("sess_")) return false;
      if (!phone || phone.length < 8) return false;
      
      // Deve ter pelo menos alguns dígitos (telefone real)
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return false;
      
      return true;
    });

    const q = search.trim().toLowerCase();
    if (!q) return valid;
    return valid.filter(c => 
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.last_message || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  // ============ ACTIONS ============

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function openSendModal(fu: FollowUp) {
    if (!selectedLead) return;
    setSendModal({ lead: selectedLead, message: fu.text });
  }

  async function confirmSend() {
    if (!sendModal) return;
    setSending(true);
    
    try {
      // Chama callback se existir
      if (props.onSendFollowUp) {
        props.onSendFollowUp(sendModal.lead, sendModal.message);
      } else {
        // Fallback: envia direto via API
        await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: sendModal.lead.phone,
            message: sendModal.message,
          }),
        });
      }
      
      setSendModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-[#f57f17]" />
            Análise IA
          </h2>
          <p className="text-sm text-gray-500">
            Follow-ups inteligentes baseados em estágio, emoção e urgência
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-[#f57f17]/10 border border-[#f57f17]/20 text-[#f57f17] text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            IA Ativa
          </span>
          <button
            onClick={loadData}
            className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Conversation List */}
        <div className="xl:col-span-4 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#f57f17]" />
              <span className="text-white font-semibold">Conversas</span>
              <span className="text-xs text-gray-500">{filteredConvs.length}</span>
            </div>
          </div>

          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full h-9 rounded-xl bg-black/30 border border-white/10 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:border-[#f57f17]/50"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto">
            {loading ? (
              <div className="p-6 text-gray-500 text-center">Carregando...</div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-gray-500 text-center">Nenhuma conversa</div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredConvs.map((c) => {
                  const active = selectedConv?.id === c.id;
                  const lead = leads.find(l => l.id === c.lead_id || l.phone.replace("@c.us", "") === (c.phone || "").replace("@c.us", ""));
                  const health = lead?.health_score || 50;
                  const displayName = c.name || lead?.name || null;
                  const displayPhone = fmtPhone((c.phone || "").replace("@c.us", ""));

                  return (
                    <button
                      key={c.id}
                      onClick={() => loadMessages(c)}
                      className={`w-full text-left px-4 py-3 transition-all ${active ? "bg-[#f57f17]/10" : "hover:bg-white/5"}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Health indicator */}
                        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          health >= 70 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" :
                          health >= 40 ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" :
                          "bg-red-500/20 border-red-500/40 text-red-300"
                        }`}>
                          {health}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium truncate">
                              {displayName || displayPhone}
                            </p>
                            <span className="text-[10px] text-gray-600">{timeAgo(c.updated_at)}</span>
                          </div>
                          {displayName && (
                            <p className="text-[11px] text-gray-500">{displayPhone}</p>
                          )}
                          <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message || "—"}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                              {stageLabel(lead?.stage)}
                            </span>
                            {lead?.urgency_level === "high" || lead?.urgency_level === "critical" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                                Urgente
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Analysis + Follow-ups */}
        <div className="xl:col-span-8 space-y-6">
          {!selectedConv ? (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-12 text-center">
              <BrainCircuit className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400">Selecione uma conversa para análise</p>
            </div>
          ) : (
            <>
              {/* Lead Info Card */}
              <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold ${
                      (selectedLead?.health_score || 50) >= 70 ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" :
                      (selectedLead?.health_score || 50) >= 40 ? "bg-yellow-500/20 border-yellow-500 text-yellow-300" :
                      "bg-red-500/20 border-red-500 text-red-300"
                    }`}>
                      {selectedLead?.health_score || 50}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {selectedConv.name || selectedLead?.name || fmtPhone(selectedConv.phone || "")}
                      </h3>
                      <p className="text-gray-500 text-sm">{fmtPhone(selectedConv.phone || "")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Estágio</p>
                      <p className="text-white font-semibold">{stageLabel(selectedLead?.stage)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Conversão</p>
                      <p className="text-emerald-400 font-semibold">
                        {Math.round((selectedLead?.conversion_probability || 0.4) * 100)}%
                      </p>
                    </div>
                    {selectedLead && (
                      <button
                        onClick={() => props.onOpenConversation?.(selectedLead)}
                        className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-white flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Abrir chat
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages preview */}
                <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3 max-h-[140px] overflow-auto">
                  {messages.slice(-6).map((m) => (
                    <div key={m.id} className={`text-sm mb-2 px-3 py-2 rounded-xl ${
                      m.from === "lead" ? "bg-white/5 text-gray-300" : "bg-[#f57f17]/10 text-white"
                    }`}>
                      <span className="text-[10px] text-gray-500 mr-2">
                        {m.from === "lead" ? "Cliente" : "Bot"}
                      </span>
                      {m.text.slice(0, 150)}{m.text.length > 150 ? "..." : ""}
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-gray-600 text-sm">Sem mensagens</p>}
                </div>
              </div>

              {/* Follow-ups */}
              <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-[#f57f17]" />
                    <span className="text-white font-bold">Follow-ups Sugeridos</span>
                  </div>
                  <button
                    onClick={() => setFollowups(generateFollowUps(selectedLead, selectedConv, messages))}
                    className="h-9 px-3 rounded-xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/20 text-xs font-semibold text-[#f57f17] flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerar
                  </button>
                </div>

                <div className="p-5 space-y-3">
                  {followups.map((fu) => (
                    <div
                      key={fu.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-[#f57f17]/20 transition"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold">{fu.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              fu.confidence >= 0.85 ? "bg-emerald-500/20 text-emerald-300" :
                              fu.confidence >= 0.75 ? "bg-yellow-500/20 text-yellow-300" :
                              "bg-white/10 text-gray-400"
                            }`}>
                              {Math.round(fu.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{fu.goal}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {fu.timing}
                        </div>
                      </div>

                      <div className="rounded-xl bg-black/30 border border-white/5 p-3 mb-3">
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{fu.text}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500">
                          {fu.stage}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyText(fu.text, fu.id)}
                            className="h-8 px-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-400 flex items-center gap-1"
                            title="Copiar mensagem"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedId === fu.id ? "Copiado!" : ""}
                          </button>
                          <button
                            onClick={() => openSendModal(fu)}
                            disabled={!selectedLead}
                            className="h-8 px-4 rounded-lg bg-gradient-to-r from-[#f57f17] to-[#ff9800] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Enviar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {followups.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      Nenhum follow-up gerado. Clique em "Regenerar".
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Send Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-[#f57f17]" />
                Confirmar Envio
              </h3>
              <button
                onClick={() => setSendModal(null)}
                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Para</p>
              <p className="text-white font-medium">
                {sendModal.lead.name || fmtPhone(sendModal.lead.phone)}
              </p>
              <p className="text-gray-500 text-sm">{fmtPhone(sendModal.lead.phone)}</p>
            </div>

            <div className="mb-6">
              <p className="text-xs text-gray-500 mb-2">Mensagem</p>
              <div className="rounded-xl bg-black/40 border border-white/10 p-4 max-h-[200px] overflow-auto">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{sendModal.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSendModal(null)}
                className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSend}
                disabled={sending}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] hover:opacity-90 disabled:opacity-50 text-sm font-semibold text-white flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Agora
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
