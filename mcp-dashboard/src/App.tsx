// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Brain,
  TrendingUp,
  Plug,
  Settings,
  RefreshCw,
  ChevronDown,
  FileText,
  BarChart3,
  Bell,
  Wand2,
  SlidersHorizontal,
} from "lucide-react";

import {
  getStats,
  getConversations,
  getLeads,
  Conversation,
  Message,
  Lead,
} from "./lib/api";

// ✅ Páginas (reais)
import DashboardV2 from "./pages/DashboardV2";
import ConversationsPage from "./pages/ConversationsPage";
import LeadsPage from "./pages/LeadsPage";
import FunnelPage from "./pages/FunnelPage";
import ReportsPage from "./pages/ReportsPage";
import TrainingPage from "./pages/TrainingPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import SettingsPage from "./pages/SettingsPage";
import AIAnalysisPage from "./pages/AIAnalysisPage";
import DemoGeneratorPage from "./pages/DemoGeneratorPage";
import AgentStudioPage from "./pages/AgentStudioPage";

// ✅ Modal IA
import AISuggestionsModal from "./components/AISuggestionsModal";

// ✅ Demo mode
import { isDemoMode, getDemoKey, getDemoData, getAllDemoOptions } from "./mock";

type PageId =
  | "dashboard"
  | "conversations"
  | "leads"
  | "funnel"
  | "analysis"
  | "reports"
  | "training"
  | "integrations"
  | "settings"
  | "demo-generator"
  | "agent-studio";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("dashboard");

  // Supabase / Real data
  const [stats, setStats] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // ✅ Demo selector dropdown
  const [industryOpen, setIndustryOpen] = useState(false);

  // ✅ Modal IA
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const demoMode = isDemoMode();
  const demoKey = demoMode ? getDemoKey() : "default";
  const demo = demoMode ? getDemoData() : null;

  // ✅ agora dropdown puxa do mock (somente geradas)
  const demoOptions = useMemo(
    () => (demoMode ? getAllDemoOptions() : []),
    [demoMode]
  );

  const menuItems: Array<{ id: PageId; label: string; icon: any }> = useMemo(
    () => {
      const base: Array<{ id: PageId; label: string; icon: any }> = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "conversations", label: "Conversas", icon: MessageSquare },
        { id: "leads", label: "Leads", icon: Users },
        { id: "funnel", label: "Funil", icon: TrendingUp },

        // ✅ novos
        { id: "analysis", label: "Análise IA", icon: BarChart3 },
        { id: "reports", label: "Relatórios", icon: FileText },

        { id: "training", label: "Treinamento", icon: Brain },
        { id: "integrations", label: "Integrações", icon: Plug },
        { id: "agent-studio", label: "Agent Studio", icon: SlidersHorizontal },
        { id: "settings", label: "Configurações", icon: Settings },
      ];

      // ✅ Demo Generator só aparece se estiver em demo mode
      if (demoMode) {
        base.splice(5, 0, {
          id: "demo-generator",
          label: "Demo Generator",
          icon: Wand2,
        });
      }

      return base;
    },
    [demoMode]
  );

useEffect(() => {
  loadData();

  // ✅ No modo demo, não precisa polling
  if (demoMode) return;

  // ✅ Polling simples (sem realtime)
  const interval = setInterval(() => {
    setLastUpdate(new Date());
    loadData();
  }, 15000); // 15s (pode ser 30s)

  return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // ✅ DEMO MODE
      if (demoMode && demo) {
        setStats(demo.stats);

        const convs = (demo.conversations || []).map((c: any) => ({
          id: c.id,
          chat_id: c.phone,
          phone: c.phone,
          name: c.name,
          last_message: c.last_message,
          status: c.status,
          updated_at: c.updated_at,
          created_at: c.created_at ?? c.updated_at,
          current_emotion: c.current_emotion,
          lead_id: c.lead_id,
          tags: c.tags || [],
        }));

        const demoLeads = (demo.leads || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,

          // ✅ seu supabase usa essas strings
          status: l.status ?? "new",

          score: l.score,
          tags: l.tags || [],
          stage: l.stage,
          urgency_level: l.urgency_level,
          health_score: l.health_score,
          conversion_probability: l.conversion_probability,
          created_at: l.created_at,
          updated_at: l.updated_at,
        }));

        setConversations(convs as any);
        setLeads(demoLeads as any);

        setLoading(false);
        return;
      }

      // ✅ PROD MODE
      const [statsData, convsData, leadsData] = await Promise.all([
        getStats(),
        getConversations(50),
        getLeads(50),
      ]);

      setStats(statsData);
      setConversations(convsData || []);
      setLeads(leadsData || []);
      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setLoading(false);
    }
  };

  // ✅ carrega mensagens para conversa selecionada
  const loadMessages = async (conv: Conversation) => {
    setSelectedConversation(conv);

    // DEMO: pega mensagens do mock
    if (demoMode && demo) {
      const msgs = (demo.messages || [])
        .filter((m: any) => m.conversation_id === conv.id)
        .sort((a: any, b: any) => (a.created_at > b.created_at ? 1 : -1))
        .map((m: any) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender: m.from,
          content: m.text,
          text: m.text,
          created_at: m.created_at,
        }));

      setMessages(msgs as any);
      return;
    }

    // PROD: (quando conectar endpoint)
    setMessages([] as any);
  };

  // ==========================================================
  // ✅ ACTIONS — Fake backend layer (por enquanto no App)
  // ==========================================================

  const handleOpenConversation = (lead: any) => {
    // tenta achar uma conversa pelo phone ou lead_id
    const conv =
      conversations.find((c: any) => c?.lead_id === lead?.id) ||
      conversations.find((c: any) => c?.phone === lead?.phone) ||
      null;

    setCurrentPage("conversations");

    if (conv) {
      setSelectedConversation(conv);
      loadMessages(conv as any);
    }
  };

  const handleSendFollowUp = (lead: any) => {
    const now = new Date().toISOString();

    // 1) Atualiza Lead (tags e scores)
    setLeads((prev) =>
      prev.map((l: any) => {
        if (l.id !== lead.id) return l;

        const nextTags = Array.from(
          new Set([...(l.tags || []), "followup_sent"])
        );
        const nextHealth = Math.min(100, (l.health_score ?? 50) + 6);
        const nextConv = Math.min(1, (l.conversion_probability ?? 0.25) + 0.06);

        return {
          ...l,
          tags: nextTags,
          health_score: nextHealth,
          conversion_probability: nextConv,
          updated_at: now,
          status: l.status === "new" ? "contacted" : l.status,
        };
      })
    );

    // 2) Atualiza Conversation (last_message)
    setConversations((prev) =>
      prev.map((c: any) => {
        const match =
          c?.lead_id === lead?.id || (c?.phone && c.phone === lead?.phone);
        if (!match) return c;

        return {
          ...c,
          last_message: "Follow-up enviado: posso te ajudar a fechar hoje?",
          updated_at: now,
          status: c.status === "closed" ? "active" : c.status,
        };
      })
    );
  };

  const handleMarkAsWon = (lead: any) => {
    const now = new Date().toISOString();

    setLeads((prev) =>
      prev.map((l: any) => {
        if (l.id !== lead.id) return l;
        return {
          ...l,
          status: "won",
          updated_at: now,
          tags: Array.from(new Set([...(l.tags || []), "won"])),
        };
      })
    );
  };

  // ==========================================================

  const currentLabel =
    menuItems.find((m) => m.id === currentPage)?.label ?? "Dashboard";

  const currentDesc = (() => {
    if (currentPage === "dashboard")
      return "Visão executiva e insights em tempo real";
    if (currentPage === "conversations")
      return "Mensagens e atendimentos em tempo real";
    if (currentPage === "leads") return "Pipeline e leads qualificados";
    if (currentPage === "funnel")
      return "War Room: decisões + ações + previsão";
    if (currentPage === "analysis")
      return "Follow-ups inteligentes, insights e automações";
    if (currentPage === "reports")
      return "Performance do funil, exportações e relatórios por período";
    if (currentPage === "training")
      return "Configure prompt, base de conhecimento e prova social";
    if (currentPage === "integrations")
      return "Conecte WhatsApp, banco e ferramentas";
    if (currentPage === "settings") return "Preferências e ajustes do sistema";
    if (currentPage === "agent-studio")
      return "Controle total do comportamento do agente: bolhas, delays, modos e estilos";
    if (currentPage === "demo-generator")
      return "Crie demos realistas e adicione no dropdown do DEV";
    return "Visão geral do sistema";
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="relative mx-auto mb-5 w-14 h-14">
            <div className="absolute inset-0 rounded-2xl bg-[#f57f17]/15 blur-xl" />
            <div className="relative w-14 h-14 rounded-2xl border border-white/10 bg-white/5 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <RefreshCw className="w-7 h-7 text-[#f57f17] animate-spin" />
            </div>
          </div>
          <p className="text-gray-300 font-medium">Carregando DOCA AI</p>
          <p className="text-gray-500 text-sm mt-1">Central de Comando</p>
        </div>
      </div>
    );
  }

  const activeDemoLabel =
    demoOptions.find((i) => i.key === demoKey)?.label ||
    (demoKey ? String(demoKey) : "Demo");

  return (
    <div className="min-h-screen text-white bg-black">
      {/* Decorative layer */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-[-140px] h-[520px] w-[520px] rounded-full bg-[#f57f17]/18 blur-3xl" />
        <div className="absolute top-12 right-[-220px] h-[560px] w-[560px] rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[18%] h-[620px] w-[620px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-[240px]">
            <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
              <img
                src="https://assets.zyrosite.com/Yan0w5Vy86ho0JE8/docafff-AR01ja72GDhG0JOo.png"
                alt="DOCA"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">DOCA AI</p>
              <p className="text-xs text-gray-500">Central de Comando</p>
            </div>

            <span className="ml-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f57f17]/10 text-[#f57f17] border border-[#f57f17]/20">
              BETA
            </span>

            {demoMode && (
              <span className="ml-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 text-gray-200 border border-white/10">
                DEMO
              </span>
            )}
          </div>

          {/* Nav (scroll horizontal + fade) */}
          <nav className="hidden lg:flex items-center gap-2 flex-1 min-w-0">
            <div className="relative w-full">
              {/* fade esquerdo */}
              <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-black/60 to-transparent z-10" />
              {/* fade direito */}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-black/60 to-transparent z-10" />

              <div className="no-scrollbar overflow-x-auto">
                <div className="flex items-center gap-2 w-max pr-6">
                  {menuItems.map((item) => {
                    const active = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentPage(item.id)}
                        className={[
                          "h-10 px-4 rounded-2xl border transition-all flex items-center gap-2 text-sm font-semibold whitespace-nowrap",
                          active
                            ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white shadow-[0_0_0_1px_rgba(245,127,23,0.14)]"
                            : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10",
                        ].join(" ")}
                      >
                        <item.icon className="w-4 h-4 text-[#f57f17]" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Industry selector (demo) */}
            {demoMode && (
              <div className="relative">
                <button
                  onClick={() => setIndustryOpen((v) => !v)}
                  className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
                >
                  {activeDemoLabel}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {industryOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-xl overflow-hidden z-30">
                    {demoOptions.map((i) => (
                      <a
                        key={i.key}
                        href={`/?demo=${i.key}`}
                        className="block px-4 py-3 text-sm text-gray-200 hover:bg-white/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{i.label}</span>
                          <span className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">
                            {i.source === "generated" ? "GERADA" : "FIXA"}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bell */}
            <button
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              title="Notificações"
            >
              <Bell className="w-4 h-4 text-gray-300" />
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4 text-[#f57f17]" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {/* Avatar */}
            <div className="h-10 px-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                <span className="text-[#f57f17] font-bold text-sm">D</span>
              </div>
              <div className="leading-tight hidden sm:block">
                <p className="text-sm font-semibold text-white">DOCA</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subheader */}
        <div className="px-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500">
              DOCA AI <span className="mx-2 text-gray-700">›</span>{" "}
              <span className="text-gray-300 font-semibold">{currentLabel}</span>
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-white mt-1">
              {currentLabel}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{currentDesc}</p>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 mt-1">
            <div>
              Status:{" "}
              <span className="text-[#f57f17] font-semibold">
                {demoMode ? "DEMO" : "Online"}
              </span>
            </div>
            <div>Atualizado: {lastUpdate.toLocaleTimeString("pt-BR")}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
          <div className="p-8">
            {currentPage === "dashboard" && (
              <DashboardV2
                demoMode={demoMode}
                stats={stats}
                conversations={conversations as any}
                leads={leads as any}
                onOpenSuggestions={() => setAiModalOpen(true)}
                onOpenInsights={() => setCurrentPage("analysis")}
                onActivateAI={() => setCurrentPage("analysis")}
                onGoToAnalysis={() => setCurrentPage("analysis")}
                onOpenEvents={() => setCurrentPage("reports")}
              />
            )}

            {currentPage === "conversations" && <ConversationsPage />}

            {currentPage === "leads" && <LeadsPage leads={leads} />}

            {currentPage === "funnel" && (
              <FunnelPage
                leads={leads}
                conversations={conversations as any}
                onOpenConversation={handleOpenConversation}
                onSendFollowUp={handleSendFollowUp}
                onMarkAsWon={handleMarkAsWon}
              />
            )}

            {currentPage === "analysis" && <AIAnalysisPage />}

            {currentPage === "reports" && (
              <ReportsPage onGoToFunnel={() => setCurrentPage("funnel")} />
            )}

            {currentPage === "training" && <TrainingPage />}

            {currentPage === "integrations" && <IntegrationsPage />}

            {currentPage === "agent-studio" && <AgentStudioPage />}

            {currentPage === "settings" && <SettingsPage />}

            {currentPage === "demo-generator" && <DemoGeneratorPage />}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
          <span>© {new Date().getFullYear()} DOCA AI</span>
          <span className="text-gray-500">
            Status:{" "}
            <span className="text-[#f57f17] font-semibold">
              {demoMode ? "DEMO" : "Online"}
            </span>
          </span>
        </div>
      </main>

      {/* ✅ Modal IA global */}
      <AISuggestionsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGoToAnalysis={() => setCurrentPage("analysis")}
      />
    </div>
  );
}
