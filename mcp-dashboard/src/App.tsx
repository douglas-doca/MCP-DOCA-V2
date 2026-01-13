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
  AlertTriangle,
  Building2,
} from "lucide-react";

import {
  getStats,
  getConversations,
  getLeads,
  Conversation,
  Message,
  Lead,
} from "./lib/api";

// Páginas
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
import UsersPage from "./pages/UsersPage";
import TenantsPage from "./pages/TenantsPage";
import { usePermissions } from "./hooks/usePermissions";
import { useAuth } from "./contexts/AuthContext";
import MetricsPage from "./pages/MetricsPage";
import TenantConfigPage from "./pages/TenantConfigPage";

// Modal IA
import AISuggestionsModal from "./components/AISuggestionsModal";

// Agent ON/OFF
import AgentToggle from "./components/AgentToggle";

// Tenant Selector (Multi-tenant)
import TenantSelector from "./components/TenantSelector";

// Demo mode
import {
  isDemoMode, getDemoKey, getDemoData, getAllDemoOptions } from "./mock";

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
  | "agent-studio"
  | "users"
  | "tenants"
  | "metrics"
  | "tenant-config";

type Notification = {
  id: string;
  type: "lead" | "urgent" | "system";
  title: string;
  message: string;
  time: Date;
  read: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("dashboard");

  // Supabase / Real data
  const [stats, setStats] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [configTenantId, setConfigTenantId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Demo selector dropdown
  const [industryOpen, setIndustryOpen] = useState(false);

  // Modal IA
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Notificações (vazio por padrão - será preenchido pelo backend)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Notificação toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const demoMode = isDemoMode();
  const { isAdmin, canManageUsers, canManageTenants, canViewMetrics } = usePermissions();
  const { profile, tenant: authTenant } = useAuth();

  // Auto-selecionar tenant para managers (não-admins)
  useEffect(() => {
    if (!isAdmin && authTenant?.id && !selectedTenantId) {
      setSelectedTenantId(authTenant.id);
    }
  }, [isAdmin, authTenant, selectedTenantId]);
  const demoKey = demoMode ? getDemoKey() : "default";
  const demo = demoMode ? getDemoData() : null;

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
        { id: "analysis", label: "Análise IA", icon: BarChart3 },
        { id: "reports", label: "Relatórios", icon: FileText },
        { id: "training", label: "Treinamento", icon: Brain },
        { id: "integrations", label: "Integrações", icon: Plug },
        { id: "agent-studio", label: "Agent Studio", icon: SlidersHorizontal },
        { id: "settings", label: "Configurações", icon: Settings },
      ];

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

  // Notificações helpers
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const markNotificationRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Carrega dados iniciais
  useEffect(() => {
    loadData(true);

    if (demoMode) return;

    const interval = setInterval(() => {
      setLastUpdate(new Date());
      loadData(false, selectedTenantId);
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega quando mudar tenant
  useEffect(() => {
    if (!demoMode) {
      loadData(false, selectedTenantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  const loadData = async (showLoading = false, tenantIdParam?: string | null) => {
    const tenantToUse = tenantIdParam !== undefined ? tenantIdParam : selectedTenantId;
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      // DEMO MODE
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
        setLastUpdate(new Date());
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // PROD MODE - com filtro de tenant
      const [statsData, convsData, leadsData] = await Promise.all([
        getStats(),
        getConversations(50, tenantToUse || undefined),
        getLeads(50, tenantToUse || undefined),
      ]);

      setStats(statsData);
      setConversations(convsData || []);
      setLeads(leadsData || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async (conv: Conversation) => {
    setSelectedConversation(conv);

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

    setMessages([] as any);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenConversation = (lead: any) => {
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

  const handleSendFollowUp = async (lead: any, customMessage?: string) => {
    const phone = lead.phone?.replace("@c.us", "").replace(/\D/g, "");
    if (!phone) {
      showNotification('error', 'Lead sem telefone válido');
      return;
    }

    let message = customMessage;
    
    if (!message) {
      const stageMessages: Record<string, string> = {
        pronto: "Oi! Vi que você está quase fechando. Posso te ajudar a finalizar agora?",
        empolgado: "E aí, tudo certo? Quer que eu te explique os próximos passos?",
        curioso: "Oi! Ficou alguma dúvida? Tô aqui pra te ajudar!",
        sensível_preço: "Oi! Consegui uma condição especial pra você. Quer saber mais?",
        cético: "Oi! Entendo suas dúvidas. Posso te mostrar alguns casos de sucesso?",
        frustrado: "Oi! Vi que teve algumas dificuldades. Como posso te ajudar?",
      };
      
      const stage = (lead.stage || "curioso").toLowerCase();
      message = stageMessages[stage] || "Oi! Tudo bem? Posso te ajudar com algo?";
    }

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.startsWith("55") ? phone : `55${phone}`,
          message,
        }),
      });

      if (!res.ok) throw new Error("Falha ao enviar");

      const now = new Date().toISOString();

      setLeads((prev) =>
        prev.map((l: any) => {
          if (l.id !== lead.id) return l;
          const nextTags = Array.from(new Set([...(l.tags || []), "followup_sent"]));
          const nextHealth = Math.min(100, (l.health_score ?? 50) + 6);
          return {
            ...l,
            tags: nextTags,
            health_score: nextHealth,
            updated_at: now,
            status: l.status === "new" ? "contacted" : l.status,
          };
        })
      );

      setConversations((prev) =>
        prev.map((c: any) => {
          const match = c?.lead_id === lead?.id || (c?.phone && c.phone === lead?.phone);
          if (!match) return c;
          return {
            ...c,
            last_message: message,
            updated_at: now,
          };
        })
      );

      showNotification('success', `Follow-up enviado para ${lead.name || phone}`);
    } catch (err) {
      console.error("Erro ao enviar follow-up:", err);
      showNotification('error', 'Erro ao enviar follow-up');
    }
  };

  const handleMarkAsWon = async (lead: any) => {
    try {
      const res = await fetch(`/api/leads?id=${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "won" }),
      });

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

      showNotification('success', `${lead.name || 'Lead'} marcado como GANHO!`);
    } catch (err) {
      console.error("Erro ao marcar como ganho:", err);
      showNotification('error', 'Erro ao marcar como ganho');
    }
  };

  const currentLabel =
    menuItems.find((m) => m.id === currentPage)?.label ?? "Dashboard";

  const currentDesc = (() => {
    if (currentPage === "dashboard") return "Visão executiva e insights em tempo real";
    if (currentPage === "conversations") return "Mensagens e atendimentos em tempo real";
    if (currentPage === "leads") return "Pipeline e leads qualificados";
    if (currentPage === "funnel") return "War Room: decisões + ações + previsão";
    if (currentPage === "analysis") return "Follow-ups inteligentes, insights e automações";
    if (currentPage === "reports") return "Performance do funil, exportações e relatórios por período";
    if (currentPage === "training") return "Configure prompt, base de conhecimento e prova social";
    if (currentPage === "integrations") return "Conecte WhatsApp, banco e ferramentas";
    if (currentPage === "settings") return "Preferências e ajustes do sistema";
    if (currentPage === "agent-studio") return "Controle total do comportamento do agente";
    if (currentPage === "demo-generator") return "Crie demos realistas";
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
        {/* Linha 1: Logo + Controles */}
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
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

            <span className="hidden sm:inline ml-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f57f17]/10 text-[#f57f17] border border-[#f57f17]/20">
              BETA
            </span>

            {demoMode && (
              <span className="hidden sm:inline ml-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 text-gray-200 border border-white/10">
                DEMO
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Tenant Selector (prod only) */}
            {!demoMode && isAdmin && (
              <TenantSelector
                value={selectedTenantId}
                onChange={setSelectedTenantId}
              />
            )}

            {/* Industry selector (demo) */}
            {demoMode && (
              <div className="relative">
                <button
                  onClick={() => setIndustryOpen((v) => !v)}
                  className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
                >
                  <span className="hidden sm:inline">{activeDemoLabel}</span>
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
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(v => !v)}
                className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center relative"
                title="Notificações"
              >
                <Bell className="w-4 h-4 text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#f57f17] text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setNotificationsOpen(false)} 
                  />
                  
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Notificações</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-[#f57f17] hover:underline"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                          Nenhuma notificação
                        </div>
                      ) : (
                        notifications.map(n => (
                          <button
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={cn(
                              "w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0",
                              !n.read && "bg-white/5"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                n.type === "urgent" && "bg-red-500/20 text-red-400",
                                n.type === "lead" && "bg-emerald-500/20 text-emerald-400",
                                n.type === "system" && "bg-white/10 text-gray-400"
                              )}>
                                {n.type === "urgent" && <AlertTriangle className="w-4 h-4" />}
                                {n.type === "lead" && <Users className="w-4 h-4" />}
                                {n.type === "system" && <Settings className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-white truncate">{n.title}</p>
                                  {!n.read && (
                                    <span className="h-2 w-2 rounded-full bg-[#f57f17] flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{n.message}</p>
                                <p className="text-[10px] text-gray-600 mt-1">
                                  {formatTimeAgo(n.time)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    
                    <div className="px-4 py-2 border-t border-white/10">
                      <button
                        onClick={() => {
                          setNotificationsOpen(false);
                          setCurrentPage("settings");
                        }}
                        className="w-full h-9 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400"
                      >
                        Configurar notificações
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Agent ON/OFF (prod only) */}
            {!demoMode && <AgentToggle />}

            {/* Refresh */}
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200 disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={cn("w-4 h-4 text-[#f57f17]", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">{refreshing ? "Atualizando..." : "Atualizar"}</span>
            </button>

{/* Avatar com Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="h-10 px-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-3 transition-all"
              >
                <div className="h-8 w-8 rounded-2xl bg-[#f57f17]/15 border border-[#f57f17]/25 flex items-center justify-center">
                  <span className="text-[#f57f17] font-bold text-sm">D</span>
                </div>
                <div className="leading-tight hidden sm:block">
                  <p className="text-sm font-semibold text-white">DOCA</p>
                  <p className="text-xs text-gray-500">Admin</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-semibold text-white">DOCA Agência IA</p>
                      <p className="text-xs text-gray-500">admin@docaperformance.com.br</p>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => { setCurrentPage("users"); setProfileMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                      >
                        <Users className="w-4 h-4" />
                        Usuários
                      </button>
                      <button
                        onClick={() => { setCurrentPage("tenants"); setProfileMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                      >
                        <Building2 className="w-4 h-4" />
                        Clientes
                      </button>
                      <button
                        onClick={() => { setCurrentPage("metrics"); setProfileMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Métricas
                      </button>
                    </div>
                    <div className="py-2 border-t border-white/10">
                      <button
                        onClick={() => { setCurrentPage("settings"); setProfileMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3"
                      >
                        <Settings className="w-4 h-4" />
                        Configurações
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Linha 2: Menu de navegação */}
        <div className="px-6 py-2 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            {menuItems.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={cn(
                    "h-9 px-3 rounded-xl border transition-all flex items-center gap-2 text-sm font-semibold whitespace-nowrap",
                    active
                      ? "border-[#f57f17]/35 bg-[#f57f17]/10 text-white shadow-[0_0_0_1px_rgba(245,127,23,0.14)]"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  )}
                >
                  <item.icon className="w-4 h-4 text-[#f57f17]" />
                  {item.label}
                </button>
              );
            })}
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

            {currentPage === "conversations" && <ConversationsPage tenantId={selectedTenantId} />}

            {currentPage === "leads" && (
              <LeadsPage
                leads={leads}
                conversations={conversations as any}
                onOpenConversation={handleOpenConversation}
                onSendFollowUp={handleSendFollowUp}
                onMarkAsWon={handleMarkAsWon}
              />
            )}

            {currentPage === "funnel" && (
              <FunnelPage
                leads={leads}
                conversations={conversations as any}
                onOpenConversation={handleOpenConversation}
                onSendFollowUp={handleSendFollowUp}
                onMarkAsWon={handleMarkAsWon}
              />
            )}

            {currentPage === "analysis" && (
              <AIAnalysisPage
                conversations={conversations}
                leads={leads}
                onSendFollowUp={handleSendFollowUp}
                onOpenConversation={handleOpenConversation}
              />
            )}

            {currentPage === "reports" && (
              <ReportsPage 
                leads={leads}
                conversations={conversations as any}
                onGoToFunnel={() => setCurrentPage("funnel")} 
              />
            )}

            {currentPage === "training" && <TrainingPage />}

            {currentPage === "integrations" && <IntegrationsPage />}

            {currentPage === "agent-studio" && <AgentStudioPage />}

            {currentPage === "settings" && <SettingsPage />}
            {currentPage === "users" && <UsersPage />}
            {currentPage === "tenants" && (
              <TenantsPage
                onConfigure={(id) => {
                  setConfigTenantId(id);
                  setCurrentPage("tenant-config");
                }}
              />
            )}
            {currentPage === "metrics" && <MetricsPage />}
            {currentPage === "tenant-config" && configTenantId && (
              <TenantConfigPage
                tenantId={configTenantId}
                onBack={() => setCurrentPage("tenants")}
              />
            )}

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

      {/* Modal IA global */}
      <AISuggestionsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGoToAnalysis={() => setCurrentPage("analysis")}
      />

      {/* Toast de notificação */}
      {notification && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl border shadow-xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-4",
            notification.type === 'success'
              ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
              : "bg-red-500/20 border-red-400/30 text-red-200"
          )}
        >
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}
    </div>
  );
}
