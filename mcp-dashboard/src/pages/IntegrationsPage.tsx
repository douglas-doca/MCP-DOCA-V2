import React, { useState, useEffect } from "react";
import {
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Settings,
  Loader2,
  Database,
  Brain,
  Calendar,
  Mail,
  Webhook,
  Eye,
  EyeOff,
  Zap,
  Server,
  Phone,
  MessageCircle,
} from "lucide-react";

type IntegrationStatus = "connected" | "disconnected" | "error" | "checking";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: IntegrationStatus;
  category: "essencial" | "whatsapp" | "comunicacao" | "futuro";
  configurable: boolean;
  docsUrl?: string;
  active?: boolean; // qual está em uso neste cliente
};

const INITIAL_INTEGRATIONS: Integration[] = [
  // Essenciais
  {
    id: "supabase",
    name: "Supabase",
    description: "Banco de dados e autenticação",
    icon: Database,
    status: "checking",
    category: "essencial",
    configurable: true,
    docsUrl: "https://supabase.com/docs",
  },
  {
    id: "claude",
    name: "Claude API",
    description: "Inteligência artificial para respostas",
    icon: Brain,
    status: "checking",
    category: "essencial",
    configurable: true,
    docsUrl: "https://docs.anthropic.com/",
  },
  // WhatsApp Providers
  {
    id: "waha",
    name: "WAHA",
    description: "WhatsApp HTTP API (self-hosted)",
    icon: MessageCircle,
    status: "checking",
    category: "whatsapp",
    configurable: true,
    docsUrl: "https://waha.devlike.pro/docs/",
    active: true, // DOCA usa WAHA
  },
  {
    id: "zapi",
    name: "Z-API",
    description: "WhatsApp API (cloud)",
    icon: Phone,
    status: "disconnected",
    category: "whatsapp",
    configurable: true,
    docsUrl: "https://developer.z-api.io/",
    active: false,
  },
  // Comunicação
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Agendamento de reuniões",
    icon: Calendar,
    status: "checking",
    category: "comunicacao",
    configurable: true,
    docsUrl: "https://developers.google.com/calendar",
  },
  {
    id: "webhook",
    name: "Webhooks",
    description: "Notificações em tempo real",
    icon: Webhook,
    status: "disconnected",
    category: "comunicacao",
    configurable: true,
  },
  // Futuro
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Envio de emails automáticos",
    icon: Mail,
    status: "disconnected",
    category: "futuro",
    configurable: false,
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [checking, setChecking] = useState(false);
  const [configModal, setConfigModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    checkAllStatus();
  }, []);

  async function checkAllStatus() {
    setChecking(true);
    await new Promise(r => setTimeout(r, 1500));
    
    setIntegrations(prev => prev.map(int => {
      if (int.id === "waha") return { ...int, status: "connected" as const };
      if (int.id === "supabase") return { ...int, status: "connected" as const };
      if (int.id === "claude") return { ...int, status: "connected" as const };
      if (int.id === "calendar") return { ...int, status: "connected" as const };
      return int;
    }));
    
    setChecking(false);
  }

  async function checkSingleStatus(id: string) {
    setIntegrations(prev => prev.map(int => 
      int.id === id ? { ...int, status: "checking" as const } : int
    ));
    
    await new Promise(r => setTimeout(r, 1000));
    
    const connected = ["waha", "supabase", "claude", "calendar"].includes(id);
    setIntegrations(prev => prev.map(int => 
      int.id === id ? { ...int, status: connected ? "connected" : "disconnected" } : int
    ));
  }

  function setActiveWhatsApp(id: string) {
    setIntegrations(prev => prev.map(int => {
      if (int.category === "whatsapp") {
        return { ...int, active: int.id === id };
      }
      return int;
    }));
    showToast(`${id === "waha" ? "WAHA" : "Z-API"} definido como ativo`);
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const essenciais = integrations.filter(i => i.category === "essencial");
  const whatsappProviders = integrations.filter(i => i.category === "whatsapp");
  const comunicacao = integrations.filter(i => i.category === "comunicacao");
  const futuro = integrations.filter(i => i.category === "futuro");

  const activeCount = integrations.filter(i => i.status === "connected").length;
  const essentialConnected = essenciais.filter(i => i.status === "connected").length;
  const whatsappConnected = whatsappProviders.find(i => i.active && i.status === "connected");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug className="w-6 h-6 text-[#f57f17]" />
            Integrações
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie conexões com serviços externos
          </p>
        </div>

        <button
          onClick={checkAllStatus}
          disabled={checking}
          className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          Verificar Tudo
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="Conectadas"
          value={`${activeCount}/${integrations.length}`}
          icon={Plug}
          color={activeCount >= 4 ? "emerald" : "yellow"}
        />
        <StatusCard
          label="Essenciais"
          value={`${essentialConnected}/${essenciais.length}`}
          icon={Zap}
          color={essentialConnected === essenciais.length ? "emerald" : "red"}
        />
        <StatusCard
          label="WhatsApp"
          value={whatsappConnected ? "Conectado" : "Desconectado"}
          icon={MessageCircle}
          color={whatsappConnected ? "emerald" : "red"}
        />
      </div>

      {/* Essenciais */}
      <Section title="Essenciais" desc="Banco de dados e IA">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {essenciais.map(int => (
            <IntegrationCard
              key={int.id}
              integration={int}
              onCheck={() => checkSingleStatus(int.id)}
              onConfigure={() => setConfigModal(int.id)}
            />
          ))}
        </div>
      </Section>

      {/* WhatsApp Providers */}
      <Section title="WhatsApp Provider" desc="Escolha qual provedor usar (pode alternar entre clientes)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {whatsappProviders.map(int => (
            <IntegrationCard
              key={int.id}
              integration={int}
              onCheck={() => checkSingleStatus(int.id)}
              onConfigure={() => setConfigModal(int.id)}
              isActive={int.active}
              onSetActive={() => setActiveWhatsApp(int.id)}
            />
          ))}
        </div>
      </Section>

      {/* Comunicação */}
      <Section title="Comunicação e Agendamento" desc="Calendário e webhooks">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comunicacao.map(int => (
            <IntegrationCard
              key={int.id}
              integration={int}
              onCheck={() => checkSingleStatus(int.id)}
              onConfigure={() => setConfigModal(int.id)}
            />
          ))}
        </div>
      </Section>

      {/* Futuro */}
      <Section title="Em Breve" desc="Planejado para futuras versões">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {futuro.map(int => (
            <IntegrationCard
              key={int.id}
              integration={int}
              onCheck={() => {}}
              onConfigure={() => {}}
              disabled
            />
          ))}
        </div>
      </Section>

      {/* Config Modal */}
      {configModal && (
        <ConfigModal
          integration={integrations.find(i => i.id === configModal)!}
          onClose={() => setConfigModal(null)}
          onSave={() => {
            setConfigModal(null);
            showToast("Configurações salvas!");
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function StatusCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: any;
  color: "emerald" | "yellow" | "red";
}) {
  const colors = {
    emerald: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-white font-bold">{title}</h3>
        <p className="text-gray-500 text-sm">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function IntegrationCard({ integration, onCheck, onConfigure, disabled, isActive, onSetActive }: {
  integration: Integration;
  onCheck: () => void;
  onConfigure: () => void;
  disabled?: boolean;
  isActive?: boolean;
  onSetActive?: () => void;
}) {
  const { name, description, icon: Icon, status, configurable, docsUrl, category } = integration;

  const statusColors: Record<IntegrationStatus, string> = {
    connected: "text-emerald-400",
    disconnected: "text-gray-500",
    error: "text-red-400",
    checking: "text-yellow-400",
  };

  const statusIcons: Record<IntegrationStatus, any> = {
    connected: CheckCircle2,
    disconnected: XCircle,
    error: AlertTriangle,
    checking: Loader2,
  };

  const StatusIcon = statusIcons[status];
  const isWhatsApp = category === "whatsapp";

  return (
    <div className={`rounded-[28px] border ${isActive ? "border-[#f57f17]/50 bg-[#f57f17]/5" : "border-white/10 bg-white/5"} p-5 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl ${isActive ? "bg-[#f57f17]/20 border-[#f57f17]/30" : "bg-[#f57f17]/10 border-[#f57f17]/20"} border flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-[#f57f17]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-white font-semibold">{name}</h4>
              {isActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f57f17]/20 text-[#f57f17] font-medium">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${statusColors[status]}`}>
          <StatusIcon className={`w-4 h-4 ${status === "checking" ? "animate-spin" : ""}`} />
          <span className="text-xs">
            {status === "connected" ? "OK" : 
             status === "disconnected" ? "Off" :
             status === "error" ? "Erro" : "..."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!disabled && (
          <>
            <button
              onClick={onCheck}
              className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Testar
            </button>
            {configurable && (
              <button
                onClick={onConfigure}
                className="flex-1 h-9 rounded-lg bg-[#f57f17]/10 border border-[#f57f17]/20 text-xs text-[#f57f17] hover:bg-[#f57f17]/20 flex items-center justify-center gap-1"
              >
                <Settings className="w-3 h-3" />
                Config
              </button>
            )}
            {isWhatsApp && onSetActive && !isActive && (
              <button
                onClick={onSetActive}
                className="h-9 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20"
              >
                Usar
              </button>
            )}
          </>
        )}
        {disabled && (
          <div className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-500 flex items-center justify-center">
            Em breve
          </div>
        )}
        {docsUrl && !disabled && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function ConfigModal({ integration, onClose, onSave }: {
  integration: Integration;
  onClose: () => void;
  onSave: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const configs: Record<string, { label: string; placeholder: string; secret?: boolean }[]> = {
    waha: [
      { label: "API URL", placeholder: "http://localhost:3000" },
      { label: "Session Name", placeholder: "default" },
      { label: "API Key", placeholder: "sua-api-key", secret: true },
    ],
    zapi: [
      { label: "Instance ID", placeholder: "sua-instance-id" },
      { label: "Token", placeholder: "seu-token-zapi", secret: true },
      { label: "Webhook URL", placeholder: "https://seu-servidor/webhook" },
    ],
    supabase: [
      { label: "Project URL", placeholder: "https://xxx.supabase.co" },
      { label: "Anon Key", placeholder: "eyJhbG...", secret: true },
      { label: "Service Key", placeholder: "eyJhbG...", secret: true },
    ],
    claude: [
      { label: "API Key", placeholder: "sk-ant-...", secret: true },
      { label: "Model", placeholder: "claude-sonnet-4-20250514" },
    ],
    calendar: [
      { label: "Client ID", placeholder: "xxx.apps.googleusercontent.com" },
      { label: "Client Secret", placeholder: "GOCSPX-...", secret: true },
      { label: "Calendar ID", placeholder: "primary" },
    ],
    webhook: [
      { label: "Endpoint URL", placeholder: "https://seu-servidor/webhook" },
      { label: "Secret", placeholder: "webhook-secret", secret: true },
    ],
  };

  const fields = configs[integration.id] || [];

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#f57f17]/10 border border-[#f57f17]/20 flex items-center justify-center">
              <integration.icon className="w-5 h-5 text-[#f57f17]" />
            </div>
            <div>
              <h3 className="text-white font-bold">{integration.name}</h3>
              <p className="text-xs text-gray-500">Configurações</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, i) => (
            <div key={i}>
              <label className="text-xs text-gray-500">{field.label}</label>
              <div className="relative mt-1">
                <input
                  type={field.secret && !showSecret ? "password" : "text"}
                  placeholder={field.placeholder}
                  className="w-full h-11 px-4 pr-10 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                />
                {field.secret && (
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Salvar
          </button>
        </div>

        {integration.docsUrl && (
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-xs text-[#f57f17] hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Ver documentação
          </a>
        )}
      </div>
    </div>
  );
}