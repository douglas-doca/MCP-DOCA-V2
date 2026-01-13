import { useState, useEffect } from "react";
import { Settings, Phone, Clock, MessageSquare, Save, Loader2, ArrowLeft, Zap, Bot } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";

type TenantConfig = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  specialty?: string;
  zapi_config?: {
    instance_id?: string;
    token?: string;
    clientToken?: string;
  };
  agent_config?: {
    enabled: boolean;
    personality: string;
    useEmojis: boolean;
    maxBubbles: number;
    delays: { base: number; perChar: number; cap: number };
  };
  business_hours?: {
    days: string[];
    open: string;
    close: string;
  };
  prompt?: string;
};

const API_BASE = "/api";

const DAYS = [
  { id: "mon", label: "Seg" },
  { id: "tue", label: "Ter" },
  { id: "wed", label: "Qua" },
  { id: "thu", label: "Qui" },
  { id: "fri", label: "Sex" },
  { id: "sat", label: "Sáb" },
  { id: "sun", label: "Dom" },
];

type Props = {
  tenantId?: string;
  onBack?: () => void;
};

export default function TenantConfigPage({ tenantId: propTenantId, onBack }: Props) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"zapi" | "agent" | "hours" | "prompt">("agent");

  // Form states
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [zapiClientToken, setZapiClientToken] = useState("");
  
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [agentPersonality, setAgentPersonality] = useState("friendly");
  const [agentUseEmojis, setAgentUseEmojis] = useState(true);
  const [agentMaxBubbles, setAgentMaxBubbles] = useState(2);
  const [agentDelayBase, setAgentDelayBase] = useState(450);
  const [agentDelayPerChar, setAgentDelayPerChar] = useState(18);
  const [agentDelayCap, setAgentDelayCap] = useState(1750);
  
  const [businessDays, setBusinessDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [businessOpen, setBusinessOpen] = useState("09:00");
  const [businessClose, setBusinessClose] = useState("18:00");
  
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (propTenantId) {
      loadTenant(propTenantId);
    }
  }, [propTenantId]);

  const loadTenant = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tenants`);
      const tenants = await res.json();
      const t = tenants.find((x: any) => x.id === id);
      
      if (t) {
        setTenant(t);
        
        // Z-API
        setZapiInstanceId(t.zapi_config?.instance_id || "");
        setZapiToken(t.zapi_config?.token || "");
        setZapiClientToken(t.zapi_config?.clientToken || "");
        
        // Agent
        setAgentEnabled(t.agent_config?.enabled ?? true);
        setAgentPersonality(t.agent_config?.personality || "friendly");
        setAgentUseEmojis(t.agent_config?.useEmojis ?? true);
        setAgentMaxBubbles(t.agent_config?.maxBubbles ?? 2);
        setAgentDelayBase(t.agent_config?.delays?.base ?? 450);
        setAgentDelayPerChar(t.agent_config?.delays?.perChar ?? 18);
        setAgentDelayCap(t.agent_config?.delays?.cap ?? 1750);
        
        // Hours
        setBusinessDays(t.business_hours?.days || ["mon", "tue", "wed", "thu", "fri"]);
        setBusinessOpen(t.business_hours?.open || "09:00");
        setBusinessClose(t.business_hours?.close || "18:00");
        
        // Prompt
        setPrompt(t.prompt || "");
      }
    } catch (err) {
      console.error("Error loading tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;
    
    try {
      setSaving(true);
      
      const updates: any = {};
      
      if (activeTab === "zapi") {
        updates.zapi_config = {
          instance_id: zapiInstanceId || null,
          token: zapiToken || null,
          clientToken: zapiClientToken || null,
        };
      } else if (activeTab === "agent") {
        updates.agent_config = {
          enabled: agentEnabled,
          personality: agentPersonality,
          useEmojis: agentUseEmojis,
          maxBubbles: agentMaxBubbles,
          delays: {
            base: agentDelayBase,
            perChar: agentDelayPerChar,
            cap: agentDelayCap,
          },
        };
      } else if (activeTab === "hours") {
        updates.business_hours = {
          days: businessDays,
          open: businessOpen,
          close: businessClose,
        };
      } else if (activeTab === "prompt") {
        updates.prompt = prompt;
      }
      
      await fetch(`${API_BASE}/tenants?id=${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      
      alert("Configurações salvas!");
    } catch (err) {
      console.error("Error saving:", err);
      alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setBusinessDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#f57f17] animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center text-gray-500 py-12">
        Selecione um cliente para configurar
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
        )}
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#f57f17]" />
            Configurar: {tenant.name}
          </h2>
          <p className="text-sm text-gray-500">@{tenant.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: "agent", label: "Agente IA", icon: Bot },
          { id: "zapi", label: "Z-API", icon: Phone },
          { id: "hours", label: "Horários", icon: Clock },
          { id: "prompt", label: "Prompt", icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#f57f17]/20 text-[#f57f17] border border-[#f57f17]/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        {activeTab === "zapi" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Configuração Z-API</h3>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Instance ID</label>
              <input
                type="text"
                value={zapiInstanceId}
                onChange={(e) => setZapiInstanceId(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
                placeholder="3E9D7E00D9E221F57F51AAEE8857FDA1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Token</label>
              <input
                type="password"
                value={zapiToken}
                onChange={(e) => setZapiToken(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Client Token</label>
              <input
                type="password"
                value={zapiClientToken}
                onChange={(e) => setZapiClientToken(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
                placeholder="••••••••"
              />
            </div>
          </div>
        )}

        {activeTab === "agent" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Configuração do Agente</h3>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <p className="font-medium text-white">Agente Ativo</p>
                <p className="text-sm text-gray-500">Ativar/desativar respostas automáticas</p>
              </div>
              <button
                onClick={() => setAgentEnabled(!agentEnabled)}
                className={`h-8 w-14 rounded-full transition-all ${agentEnabled ? "bg-[#f57f17]" : "bg-white/20"}`}
              >
                <div className={`h-6 w-6 rounded-full bg-white transition-all ${agentEnabled ? "ml-7" : "ml-1"}`} />
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Personalidade</label>
              <select
                value={agentPersonality}
                onChange={(e) => setAgentPersonality(e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
              >
                <option value="friendly">Amigável</option>
                <option value="professional">Profissional</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <p className="font-medium text-white">Usar Emojis</p>
                <p className="text-sm text-gray-500">Incluir emojis nas respostas</p>
              </div>
              <button
                onClick={() => setAgentUseEmojis(!agentUseEmojis)}
                className={`h-8 w-14 rounded-full transition-all ${agentUseEmojis ? "bg-[#f57f17]" : "bg-white/20"}`}
              >
                <div className={`h-6 w-6 rounded-full bg-white transition-all ${agentUseEmojis ? "ml-7" : "ml-1"}`} />
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Máx. Bolhas por Resposta</label>
              <input
                type="number"
                value={agentMaxBubbles}
                onChange={(e) => setAgentMaxBubbles(parseInt(e.target.value) || 2)}
                min={1}
                max={5}
                className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Delay Base (ms)</label>
                <input
                  type="number"
                  value={agentDelayBase}
                  onChange={(e) => setAgentDelayBase(parseInt(e.target.value) || 450)}
                  className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Delay/Char (ms)</label>
                <input
                  type="number"
                  value={agentDelayPerChar}
                  onChange={(e) => setAgentDelayPerChar(parseInt(e.target.value) || 18)}
                  className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Delay Máx (ms)</label>
                <input
                  type="number"
                  value={agentDelayCap}
                  onChange={(e) => setAgentDelayCap(parseInt(e.target.value) || 1750)}
                  className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "hours" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Horário de Funcionamento</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Dias Ativos</label>
              <div className="flex gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`h-10 w-12 rounded-lg text-sm font-medium transition-all ${
                      businessDays.includes(day.id)
                        ? "bg-[#f57f17] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Abre às</label>
                <input
                  type="time"
                  value={businessOpen}
                  onChange={(e) => setBusinessOpen(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Fecha às</label>
                <input
                  type="time"
                  value={businessClose}
                  onChange={(e) => setBusinessClose(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "prompt" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Prompt do Agente</h3>
            <p className="text-sm text-gray-500 mb-2">
              Instruções personalizadas para o agente deste cliente
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50 resize-none font-mono text-sm"
              placeholder="Você é um assistente especializado em..."
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-6 rounded-xl bg-[#f57f17] hover:bg-[#ef6c00] text-white font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
