import React, { useState } from "react";
import {
  Settings,
  User,
  Building2,
  Clock,
  Bell,
  Shield,
  Database,
  Palette,
  Save,
  Loader2,
  CheckCircle2,
  Moon,
  Sun,
  Globe,
  Phone,
  Mail,
  MapPin,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Info,
  Key,
  RefreshCw,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";

type BusinessHours = {
  enabled: boolean;
  start: string;
  end: string;
  days: string[];
};

type SettingsData = {
  // Perfil
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  
  // Horário
  businessHours: BusinessHours;
  timezone: string;
  
  // Notificações
  notifyNewLead: boolean;
  notifyUrgent: boolean;
  notifyDaily: boolean;
  notifyEmail: boolean;
  
  // Sistema
  language: string;
  theme: "dark" | "light" | "auto";
  autoBackup: boolean;
  
  // Agente
  agentName: string;
  welcomeMessage: string;
  offlineMessage: string;
};

const DEFAULT_SETTINGS: SettingsData = {
  companyName: "DOCA Agência IA",
  ownerName: "Douglas",
  email: "contato@docaia.com.br",
  phone: "(19) 99154-7727",
  address: "Limeira, SP",
  
  businessHours: {
    enabled: true,
    start: "08:00",
    end: "18:00",
    days: ["seg", "ter", "qua", "qui", "sex"],
  },
  timezone: "America/Sao_Paulo",
  
  notifyNewLead: true,
  notifyUrgent: true,
  notifyDaily: false,
  notifyEmail: false,
  
  language: "pt-BR",
  theme: "dark",
  autoBackup: true,
  
  agentName: "Assistente DOCA",
  welcomeMessage: "Oi! Como posso ajudar?",
  offlineMessage: "Estamos fora do horário. Retornaremos em breve!",
};

const DAYS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<"perfil" | "horario" | "notificacoes" | "sistema" | "agente" | "dados">("perfil");
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    showToast("Configurações salvas!");
  }

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function updateBusinessHours<K extends keyof BusinessHours>(key: K, value: BusinessHours[K]) {
    setSettings(prev => ({
      ...prev,
      businessHours: { ...prev.businessHours, [key]: value }
    }));
  }

  function toggleDay(day: string) {
    const current = settings.businessHours.days;
    const newDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    updateBusinessHours("days", newDays);
  }

  const TABS = [
    { key: "perfil", label: "Perfil", icon: Building2 },
    { key: "horario", label: "Horário", icon: Clock },
    { key: "notificacoes", label: "Notificações", icon: Bell },
    { key: "sistema", label: "Sistema", icon: Settings },
    { key: "agente", label: "Agente", icon: User },
    { key: "dados", label: "Dados", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#f57f17]" />
            Configurações
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Personalize o sistema conforme suas necessidades
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Tudo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium whitespace-nowrap transition ${
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

      {/* TAB: PERFIL */}
      {tab === "perfil" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Empresa" icon={Building2}>
            <div className="space-y-4">
              <InputField
                label="Nome da Empresa"
                value={settings.companyName}
                onChange={v => update("companyName", v)}
                icon={Building2}
              />
              <InputField
                label="Responsável"
                value={settings.ownerName}
                onChange={v => update("ownerName", v)}
                icon={User}
              />
              <InputField
                label="Endereço"
                value={settings.address}
                onChange={v => update("address", v)}
                icon={MapPin}
              />
            </div>
          </Card>

          <Card title="Contato" icon={Phone}>
            <div className="space-y-4">
              <InputField
                label="Email"
                value={settings.email}
                onChange={v => update("email", v)}
                icon={Mail}
                type="email"
              />
              <InputField
                label="Telefone"
                value={settings.phone}
                onChange={v => update("phone", v)}
                icon={Phone}
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB: HORÁRIO */}
      {tab === "horario" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Horário de Funcionamento" icon={Clock}>
            <div className="space-y-4">
              <ToggleRow
                label="Respeitar horário comercial"
                desc="Fora do horário, envia mensagem de ausência"
                value={settings.businessHours.enabled}
                onChange={v => updateBusinessHours("enabled", v)}
              />

              {settings.businessHours.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Início</label>
                      <input
                        type="time"
                        value={settings.businessHours.start}
                        onChange={e => updateBusinessHours("start", e.target.value)}
                        className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Fim</label>
                      <input
                        type="time"
                        value={settings.businessHours.end}
                        onChange={e => updateBusinessHours("end", e.target.value)}
                        className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Dias de funcionamento</label>
                    <div className="flex gap-2 mt-2">
                      {DAYS.map(d => (
                        <button
                          key={d.key}
                          onClick={() => toggleDay(d.key)}
                          className={`h-10 w-10 rounded-lg text-xs font-medium transition ${
                            settings.businessHours.days.includes(d.key)
                              ? "bg-[#f57f17]/20 border border-[#f57f17]/30 text-white"
                              : "bg-white/5 border border-white/10 text-gray-500"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card title="Fuso Horário" icon={Globe}>
            <div>
              <label className="text-xs text-gray-500">Timezone</label>
              <select
                value={settings.timezone}
                onChange={e => update("timezone", e.target.value)}
                className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
              >
                <option value="America/Sao_Paulo" className="bg-black">São Paulo (GMT-3)</option>
                <option value="America/Manaus" className="bg-black">Manaus (GMT-4)</option>
                <option value="America/Fortaleza" className="bg-black">Fortaleza (GMT-3)</option>
                <option value="America/Recife" className="bg-black">Recife (GMT-3)</option>
              </select>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: NOTIFICAÇÕES */}
      {tab === "notificacoes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Alertas no Sistema" icon={Bell}>
            <div className="space-y-4">
              <ToggleRow
                label="Novo lead"
                desc="Notificar quando chegar um lead novo"
                value={settings.notifyNewLead}
                onChange={v => update("notifyNewLead", v)}
              />
              <ToggleRow
                label="Leads urgentes"
                desc="Notificar leads com urgência alta/crítica"
                value={settings.notifyUrgent}
                onChange={v => update("notifyUrgent", v)}
              />
              <ToggleRow
                label="Resumo diário"
                desc="Receber resumo do dia às 18h"
                value={settings.notifyDaily}
                onChange={v => update("notifyDaily", v)}
              />
            </div>
          </Card>

          <Card title="Notificações Externas" icon={Mail}>
            <div className="space-y-4">
              <ToggleRow
                label="Email"
                desc="Enviar cópia das notificações por email"
                value={settings.notifyEmail}
                onChange={v => update("notifyEmail", v)}
              />
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-gray-500">Email de notificação</p>
                <p className="text-sm text-gray-300 mt-1">{settings.email}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: SISTEMA */}
      {tab === "sistema" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Aparência" icon={Palette}>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Tema</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { key: "dark", label: "Escuro", icon: Moon },
                    { key: "light", label: "Claro", icon: Sun },
                    { key: "auto", label: "Auto", icon: Settings },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => update("theme", t.key as any)}
                      className={`h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition ${
                        settings.theme === t.key
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

              <div>
                <label className="text-xs text-gray-500">Idioma</label>
                <select
                  value={settings.language}
                  onChange={e => update("language", e.target.value)}
                  className="w-full h-11 mt-1 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                >
                  <option value="pt-BR" className="bg-black">Português (Brasil)</option>
                  <option value="en-US" className="bg-black">English (US)</option>
                  <option value="es" className="bg-black">Español</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title="Segurança" icon={Shield}>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">API Key do Sistema</label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value="doca_sk_live_xxxxxxxxxxxxxxxx"
                      readOnly
                      className="w-full h-11 px-4 pr-10 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-400 outline-none"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: AGENTE */}
      {tab === "agente" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Identidade do Agente" icon={User}>
            <div className="space-y-4">
              <InputField
                label="Nome do Agente"
                value={settings.agentName}
                onChange={v => update("agentName", v)}
                placeholder="Ex: Assistente DOCA"
              />
              <div>
                <label className="text-xs text-gray-500">Mensagem de Boas-vindas</label>
                <textarea
                  value={settings.welcomeMessage}
                  onChange={e => update("welcomeMessage", e.target.value)}
                  className="w-full h-24 mt-1 p-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
                  placeholder="Mensagem inicial do agente..."
                />
              </div>
            </div>
          </Card>

          <Card title="Mensagens Automáticas" icon={Clock}>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Mensagem Fora do Horário</label>
                <textarea
                  value={settings.offlineMessage}
                  onChange={e => update("offlineMessage", e.target.value)}
                  className="w-full h-24 mt-1 p-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
                  placeholder="Mensagem quando estiver offline..."
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: DADOS */}
      {tab === "dados" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Backup" icon={Database}>
            <div className="space-y-4">
              <ToggleRow
                label="Backup automático"
                desc="Salvar dados automaticamente todo dia às 3h"
                value={settings.autoBackup}
                onChange={v => update("autoBackup", v)}
              />
              
              <div className="flex gap-2">
                <button className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Exportar Dados
                </button>
                <button className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  Importar Dados
                </button>
              </div>
            </div>
          </Card>

          <Card title="Zona de Perigo" icon={AlertTriangle} danger>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Ações irreversíveis
                </p>
              </div>
              
              <button className="w-full h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" />
                Limpar Todos os Dados
              </button>
            </div>
          </Card>

          <Card title="Sobre" icon={Info} className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoBox label="Versão" value="2.0.0" />
              <InfoBox label="Build" value="2025.01.13" />
              <InfoBox label="Ambiente" value="Produção" />
              <InfoBox label="Uptime" value="99.9%" />
            </div>
          </Card>
        </div>
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

function Card({ title, icon: Icon, children, className, danger }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  className?: string;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-[28px] border ${danger ? "border-red-500/20 bg-red-500/5" : "border-white/10 bg-white/5"} p-6 ${className || ""}`}>
      <h3 className={`font-bold mb-4 flex items-center gap-2 ${danger ? "text-red-400" : "text-white"}`}>
        <Icon className={`w-5 h-5 ${danger ? "text-red-400" : "text-[#f57f17]"}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, icon: Icon, type, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: any;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative mt-1">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        )}
        <input
          type={type || "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-11 ${Icon ? "pl-11" : "pl-4"} pr-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none`}
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`h-8 w-14 rounded-full transition relative ${value ? "bg-[#f57f17]" : "bg-white/10"}`}
      >
        <div className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${value ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-white font-semibold mt-1">{value}</p>
    </div>
  );
}