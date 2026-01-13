import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Bot,
  Power,
  Zap,
  MessageSquare,
  Clock,
  Settings,
  Save,
  RotateCcw,
  Loader2,
  Sparkles,
  Send,
  Timer,
  Target,
  Info,
  Flame,
  Snowflake,
  ThermometerSun,
  Frown,
  Smile,
  AlertTriangle,
  DollarSign,
  HelpCircle,
  FileText,
  Play,
  Eye,
  Layers,
  Brain,
  Gauge,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

// ============ TYPES ============

type CTA = "soft" | "medium" | "hard";

type StageBehavior = {
  maxBubbles: number;
  requireQuestion: boolean;
  ctaLevel: CTA;
};

type EmotionMultipliers = {
  anxious: number;
  skeptical: number;
  frustrated: number;
  excited: number;
  price_sensitive: number;
  ready: number;
  curious: number;
};

type AgentConfig = {
  enabled: boolean;
  personality: "formal" | "casual" | "friendly";
  responseSpeed: "fast" | "normal" | "human";
  maxBubbles: number;
  maxEmojisPerBubble: number;
  useEmojis: boolean;
  
  delayBase: number;
  delayPerChar: number;
  delayCap: number;
  
  stageBehavior: {
    cold: StageBehavior;
    warm: StageBehavior;
    hot: StageBehavior;
  };
  
  emotionMultipliers: EmotionMultipliers;
  escalateOnFrustration: boolean;
  
  templates: {
    primeiro_contato: { bubble1: string; bubble2: string };
    cliente_bravo: { bubble1: string; bubble2: string };
    orcamento: { bubble1: string; bubble2: string };
    agendamento: { bubble1: string; bubble2: string };
  };
};

const DEFAULT_CONFIG: AgentConfig = {
  enabled: true,
  personality: "friendly",
  responseSpeed: "human",
  maxBubbles: 2,
  maxEmojisPerBubble: 1,
  useEmojis: false,
  
  delayBase: 450,
  delayPerChar: 18,
  delayCap: 1750,
  
  stageBehavior: {
    cold: { maxBubbles: 2, requireQuestion: true, ctaLevel: "soft" },
    warm: { maxBubbles: 2, requireQuestion: true, ctaLevel: "medium" },
    hot: { maxBubbles: 2, requireQuestion: false, ctaLevel: "hard" },
  },
  
  emotionMultipliers: {
    anxious: 0.6,
    skeptical: 1.15,
    frustrated: 1.0,
    excited: 0.9,
    price_sensitive: 1.08,
    ready: 0.92,
    curious: 1.0,
  },
  escalateOnFrustration: true,
  
  templates: {
    primeiro_contato: {
      bubble1: "Oi! Prazer, sou da DOCA.",
      bubble2: "Me conta: você busca melhorar marketing, vendas ou operação?",
    },
    cliente_bravo: {
      bubble1: "Entendi. Sinto muito por isso.",
      bubble2: "Me diz o que aconteceu que eu resolvo pra você agora.",
    },
    orcamento: {
      bubble1: "Consigo sim! Pra eu te passar certinho:",
      bubble2: "É pra você ou pra equipe? E qual objetivo principal?",
    },
    agendamento: {
      bubble1: "Perfeito! Vamos marcar.",
      bubble2: "Qual melhor dia e horário pra você?",
    },
  },
};

// ============ API HELPERS ============

const API_BASE = import.meta.env.VITE_API_URL || "";

async function loadAgentConfig(): Promise<AgentConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/settings?key=agent_studio_config`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.value) {
      return { ...DEFAULT_CONFIG, ...data.value };
    }
    return null;
  } catch {
    return null;
  }
}

async function saveAgentConfig(config: AgentConfig): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "agent_studio_config", value: config }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ MAIN COMPONENT ============

export default function AgentStudioPage() {
  const [tab, setTab] = useState<"basico" | "estagio" | "emocao" | "templates" | "preview">("basico");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preview state
  const [previewStage, setPreviewStage] = useState<"cold" | "warm" | "hot">("warm");
  const [previewEmotion, setPreviewEmotion] = useState<keyof EmotionMultipliers>("curious");
  const [previewMessages, setPreviewMessages] = useState<{ role: "user" | "agent"; text: string; delay?: number }[]>([]);
  const [previewInput, setPreviewInput] = useState("");
  const [previewTyping, setPreviewTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load config on mount
  useEffect(() => {
    loadAgentConfig().then(data => {
      if (data) {
        setConfig(data);
        setOriginalConfig(data);
      }
      setLoading(false);
    });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [previewMessages]);

  const hasChanges = useMemo(() => 
    JSON.stringify(config) !== JSON.stringify(originalConfig)
  , [config, originalConfig]);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  async function handleSave() {
    setSaving(true);
    const success = await saveAgentConfig(config);
    setSaving(false);
    
    if (success) {
      setOriginalConfig(config);
      showToast("success", "Configurações salvas!");
    } else {
      showToast("error", "Erro ao salvar");
    }
  }

  function handleReset() {
    setConfig(originalConfig);
    showToast("success", "Alterações descartadas");
  }

  function updateConfig<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function updateStageBehavior(stage: "cold" | "warm" | "hot", behavior: StageBehavior) {
    setConfig(prev => ({
      ...prev,
      stageBehavior: { ...prev.stageBehavior, [stage]: behavior }
    }));
  }

  function updateEmotionMultiplier(emotion: keyof EmotionMultipliers, value: number) {
    setConfig(prev => ({
      ...prev,
      emotionMultipliers: { ...prev.emotionMultipliers, [emotion]: value }
    }));
  }

  function updateTemplate(intent: keyof AgentConfig["templates"], field: "bubble1" | "bubble2", value: string) {
    setConfig(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        [intent]: { ...prev.templates[intent], [field]: value }
      }
    }));
  }

  // ============ PREVIEW LOGIC ============

  function calculateDelay(text: string): number {
    const mult = config.emotionMultipliers[previewEmotion];
    const base = config.delayBase;
    const perChar = config.delayPerChar * text.length;
    const total = (base + perChar) * mult;
    return Math.min(Math.round(total), config.delayCap);
  }

  function detectIntent(text: string): keyof AgentConfig["templates"] {
    const lower = text.toLowerCase();
    if (lower.includes("preço") || lower.includes("valor") || lower.includes("quanto custa") || lower.includes("orçamento")) {
      return "orcamento";
    }
    if (lower.includes("agendar") || lower.includes("marcar") || lower.includes("horário") || lower.includes("reunião")) {
      return "agendamento";
    }
    if (lower.includes("problema") || lower.includes("não funciona") || lower.includes("erro") || lower.includes("reclamar")) {
      return "cliente_bravo";
    }
    return "primeiro_contato";
  }

  async function handleSendPreview() {
    if (!previewInput.trim() || previewTyping) return;
    
    const userText = previewInput.trim();
    setPreviewInput("");
    setPreviewMessages(prev => [...prev, { role: "user", text: userText }]);
    
    setPreviewTyping(true);
    
    const intent = detectIntent(userText);
    const template = config.templates[intent];
    const stageCfg = config.stageBehavior[previewStage];
    
    const delay1 = calculateDelay(template.bubble1);
    await new Promise(r => setTimeout(r, delay1));
    
    setPreviewMessages(prev => [...prev, { role: "agent", text: template.bubble1, delay: delay1 }]);
    
    if (stageCfg.maxBubbles >= 2 && template.bubble2) {
      const delay2 = calculateDelay(template.bubble2);
      await new Promise(r => setTimeout(r, delay2));
      
      let bubble2 = template.bubble2;
      
      if (stageCfg.requireQuestion && !bubble2.includes("?")) {
        const ctas: Record<CTA, string> = {
          soft: " Me conta mais sobre seu cenário?",
          medium: " Quer que eu te mostre um exemplo?",
          hard: " Bora marcar 15 min hoje ou amanhã?",
        };
        bubble2 += ctas[stageCfg.ctaLevel];
      }
      
      setPreviewMessages(prev => [...prev, { role: "agent", text: bubble2, delay: delay2 }]);
    }
    
    setPreviewTyping(false);
  }

  const previewDelay = useMemo(() => {
    const mult = config.emotionMultipliers[previewEmotion];
    const base = config.delayBase * mult;
    return Math.round(Math.min(base, config.delayCap));
  }, [config, previewEmotion]);

  const TABS = [
    { key: "basico", label: "Básico", icon: Settings },
    { key: "estagio", label: "Por Estágio", icon: Layers },
    { key: "emocao", label: "Por Emoção", icon: Brain },
    { key: "templates", label: "Templates", icon: FileText },
    { key: "preview", label: "Preview", icon: Play },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#f57f17] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#f57f17]" />
            Agent Studio
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Configure o comportamento avançado do agente IA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 flex items-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Descartar
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${
        config.enabled 
          ? "bg-emerald-500/10 border border-emerald-500/20" 
          : "bg-red-500/10 border border-red-500/20"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
            config.enabled ? "bg-emerald-500/20" : "bg-red-500/20"
          }`}>
            <Power className={`w-5 h-5 ${config.enabled ? "text-emerald-400" : "text-red-400"}`} />
          </div>
          <div>
            <p className={`font-semibold ${config.enabled ? "text-emerald-300" : "text-red-300"}`}>
              Agente {config.enabled ? "Ativo" : "Desativado"}
            </p>
            <p className="text-xs text-gray-500">
              {config.enabled ? "Respondendo automaticamente" : "Apenas humanos respondem"}
            </p>
          </div>
        </div>
        <button
          onClick={() => updateConfig("enabled", !config.enabled)}
          className={`h-10 px-4 rounded-xl text-sm font-medium transition ${
            config.enabled
              ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
              : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          }`}
        >
          {config.enabled ? "Desativar" : "Ativar"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
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

      {/* ============ TAB: BÁSICO ============ */}
      {tab === "basico" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Personalidade" icon={Bot}>
            <div className="grid grid-cols-3 gap-3">
              <OptionCard
                selected={config.personality === "formal"}
                onClick={() => updateConfig("personality", "formal")}
                title="Formal"
                desc="Linguagem corporativa"
                hint="B2B, jurídico"
              />
              <OptionCard
                selected={config.personality === "casual"}
                onClick={() => updateConfig("personality", "casual")}
                title="Casual"
                desc="Descontraído"
                hint="Varejo, jovem"
              />
              <OptionCard
                selected={config.personality === "friendly"}
                onClick={() => updateConfig("personality", "friendly")}
                title="Amigável"
                desc="Acolhedor"
                hint="Serviços, saúde"
              />
            </div>
          </Card>

          <Card title="Velocidade de Resposta" icon={Timer}>
            <div className="grid grid-cols-3 gap-3">
              <OptionCard
                selected={config.responseSpeed === "fast"}
                onClick={() => updateConfig("responseSpeed", "fast")}
                title="Rápido"
                desc="< 1 segundo"
                hint="Bot evidente"
              />
              <OptionCard
                selected={config.responseSpeed === "normal"}
                onClick={() => updateConfig("responseSpeed", "normal")}
                title="Normal"
                desc="1-2 segundos"
                hint="Balanceado"
              />
              <OptionCard
                selected={config.responseSpeed === "human"}
                onClick={() => updateConfig("responseSpeed", "human")}
                title="Humano"
                desc="2-4 segundos"
                hint="Mais natural"
              />
            </div>
          </Card>

          <Card title="Limites de Resposta" icon={MessageSquare}>
            <div className="space-y-4">
              <SliderRow
                label="Máx. bolhas por resposta"
                value={config.maxBubbles}
                min={1}
                max={4}
                onChange={v => updateConfig("maxBubbles", v)}
              />
              <ToggleRow
                label="Usar emojis"
                desc="Adiciona emojis nas respostas"
                value={config.useEmojis}
                onChange={v => updateConfig("useEmojis", v)}
              />
              {config.useEmojis && (
                <SliderRow
                  label="Máx. emojis por bolha"
                  value={config.maxEmojisPerBubble}
                  min={0}
                  max={3}
                  onChange={v => updateConfig("maxEmojisPerBubble", v)}
                />
              )}
            </div>
          </Card>

          <Card title="Delay de Digitação" icon={Clock}>
            <div className="space-y-4">
              <SliderRow
                label="Delay base (ms)"
                value={config.delayBase}
                min={100}
                max={1000}
                onChange={v => updateConfig("delayBase", v)}
              />
              <SliderRow
                label="Delay por caractere (ms)"
                value={config.delayPerChar}
                min={5}
                max={50}
                onChange={v => updateConfig("delayPerChar", v)}
              />
              <SliderRow
                label="Delay máximo (ms)"
                value={config.delayCap}
                min={500}
                max={5000}
                onChange={v => updateConfig("delayCap", v)}
              />
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-gray-500">Delay estimado para 50 chars:</p>
                <p className="text-white font-semibold">
                  {Math.min(config.delayBase + config.delayPerChar * 50, config.delayCap)}ms
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ============ TAB: POR ESTÁGIO ============ */}
      {tab === "estagio" && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#f57f17]/20 bg-[#f57f17]/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#f57f17] mt-0.5" />
              <div>
                <h4 className="text-white font-semibold">Comportamento por Temperatura</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Configure como o agente se comporta em cada fase do funil. Leads frios precisam de mais perguntas, leads quentes podem receber CTAs mais diretos.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StageCard
              stage="cold"
              icon={Snowflake}
              color="blue"
              title="Frio"
              desc="Primeiro contato, desconhecido"
              behavior={config.stageBehavior.cold}
              onChange={b => updateStageBehavior("cold", b)}
            />
            <StageCard
              stage="warm"
              icon={ThermometerSun}
              color="yellow"
              title="Morno"
              desc="Engajado, considerando"
              behavior={config.stageBehavior.warm}
              onChange={b => updateStageBehavior("warm", b)}
            />
            <StageCard
              stage="hot"
              icon={Flame}
              color="orange"
              title="Quente"
              desc="Pronto para fechar"
              behavior={config.stageBehavior.hot}
              onChange={b => updateStageBehavior("hot", b)}
            />
          </div>
        </div>
      )}

      {/* ============ TAB: POR EMOÇÃO ============ */}
      {tab === "emocao" && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#f57f17]/20 bg-[#f57f17]/5 p-5">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-[#f57f17] mt-0.5" />
              <div>
                <h4 className="text-white font-semibold">Multiplicadores de Emoção</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Ajuste o tempo de resposta baseado na emoção detectada. Valores menores = resposta mais rápida. Lead ansioso? Responda rápido. Lead cético? Dê tempo para digerir.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmotionCard
              emotion="anxious"
              icon={AlertTriangle}
              label="Ansioso"
              desc="Preocupado, urgente"
              value={config.emotionMultipliers.anxious}
              onChange={v => updateEmotionMultiplier("anxious", v)}
              hint="Responda rápido para acalmar"
            />
            <EmotionCard
              emotion="skeptical"
              icon={HelpCircle}
              label="Cético"
              desc="Desconfiado, questionador"
              value={config.emotionMultipliers.skeptical}
              onChange={v => updateEmotionMultiplier("skeptical", v)}
              hint="Dê tempo para processar"
            />
            <EmotionCard
              emotion="frustrated"
              icon={Frown}
              label="Frustrado"
              desc="Irritado, problema"
              value={config.emotionMultipliers.frustrated}
              onChange={v => updateEmotionMultiplier("frustrated", v)}
              hint="Resposta imediata + escalar se persistir"
            />
            <EmotionCard
              emotion="excited"
              icon={Smile}
              label="Empolgado"
              desc="Animado, positivo"
              value={config.emotionMultipliers.excited}
              onChange={v => updateEmotionMultiplier("excited", v)}
              hint="Mantenha a energia"
            />
            <EmotionCard
              emotion="price_sensitive"
              icon={DollarSign}
              label="Sensível a Preço"
              desc="Preocupado com custo"
              value={config.emotionMultipliers.price_sensitive}
              onChange={v => updateEmotionMultiplier("price_sensitive", v)}
              hint="Construa valor antes do preço"
            />
            <EmotionCard
              emotion="ready"
              icon={Target}
              label="Pronto"
              desc="Decidido, quer fechar"
              value={config.emotionMultipliers.ready}
              onChange={v => updateEmotionMultiplier("ready", v)}
              hint="Agilize o fechamento"
            />
            <EmotionCard
              emotion="curious"
              icon={Eye}
              label="Curioso"
              desc="Explorando, interessado"
              value={config.emotionMultipliers.curious}
              onChange={v => updateEmotionMultiplier("curious", v)}
              hint="Padrão - neutro"
            />
          </div>

          <ToggleRow
            label="Escalar em frustração"
            desc="Notificar humano se frustração persistir"
            value={config.escalateOnFrustration}
            onChange={v => updateConfig("escalateOnFrustration", v)}
          />
        </div>
      )}

      {/* ============ TAB: TEMPLATES ============ */}
      {tab === "templates" && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#f57f17]/20 bg-[#f57f17]/5 p-5">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#f57f17] mt-0.5" />
              <div>
                <h4 className="text-white font-semibold">Templates por Intenção</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Configure as respostas padrão para cada tipo de intenção detectada. O agente usa estes templates como base e adapta conforme o contexto.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TemplateCard
              intent="primeiro_contato"
              title="Primeiro Contato"
              desc="Lead novo, primeira interação"
              template={config.templates.primeiro_contato}
              onChange={(f, v) => updateTemplate("primeiro_contato", f, v)}
            />
            <TemplateCard
              intent="cliente_bravo"
              title="Cliente Bravo"
              desc="Reclamação ou problema"
              template={config.templates.cliente_bravo}
              onChange={(f, v) => updateTemplate("cliente_bravo", f, v)}
            />
            <TemplateCard
              intent="orcamento"
              title="Orçamento"
              desc="Pergunta sobre preço"
              template={config.templates.orcamento}
              onChange={(f, v) => updateTemplate("orcamento", f, v)}
            />
            <TemplateCard
              intent="agendamento"
              title="Agendamento"
              desc="Quer marcar reunião"
              template={config.templates.agendamento}
              onChange={(f, v) => updateTemplate("agendamento", f, v)}
            />
          </div>
        </div>
      )}

      {/* ============ TAB: PREVIEW ============ */}
      {tab === "preview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Preview */}
          <div className="lg:col-span-2 rounded-[28px] border border-white/10 bg-white/5 flex flex-col h-[600px]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Play className="w-5 h-5 text-[#f57f17]" />
                  Preview em Tempo Real
                </h3>
                <p className="text-gray-500 text-sm">Teste suas configurações</p>
              </div>
              <button
                onClick={() => setPreviewMessages([])}
                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mb-2" />
                  <p>Envie uma mensagem para testar</p>
                  <p className="text-xs mt-1">Use os controles ao lado para simular cenários</p>
                </div>
              ) : (
                previewMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === "user" 
                        ? "bg-[#f57f17]/20 text-white" 
                        : "bg-white/5 border border-white/10 text-gray-200"
                    }`}>
                      <p className="text-sm">{msg.text}</p>
                      {msg.delay && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          ⏱️ {msg.delay}ms
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {previewTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={previewInput}
                  onChange={e => setPreviewInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendPreview()}
                  placeholder="Digite uma mensagem de teste..."
                  className="flex-1 h-11 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
                  disabled={previewTyping}
                />
                <button
                  onClick={handleSendPreview}
                  disabled={previewTyping || !previewInput.trim()}
                  className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Stage Selector */}
            <Card title="Estágio Simulado" icon={Layers}>
              <div className="space-y-2">
                {([
                  { key: "cold", label: "Frio", icon: Snowflake },
                  { key: "warm", label: "Morno", icon: ThermometerSun },
                  { key: "hot", label: "Quente", icon: Flame },
                ] as const).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setPreviewStage(s.key)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
                      previewStage === s.key
                        ? "bg-[#f57f17]/20 border border-[#f57f17]/30"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <s.icon className={`w-4 h-4 ${previewStage === s.key ? "text-[#f57f17]" : "text-gray-400"}`} />
                    <span className={previewStage === s.key ? "text-white" : "text-gray-400"}>{s.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Emotion Selector */}
            <Card title="Emoção Simulada" icon={Brain}>
              <select
                value={previewEmotion}
                onChange={e => setPreviewEmotion(e.target.value as keyof EmotionMultipliers)}
                className="w-full h-11 px-4 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none"
              >
                <option value="curious" className="bg-black">Curioso</option>
                <option value="anxious" className="bg-black">Ansioso</option>
                <option value="skeptical" className="bg-black">Cético</option>
                <option value="frustrated" className="bg-black">Frustrado</option>
                <option value="excited" className="bg-black">Empolgado</option>
                <option value="price_sensitive" className="bg-black">Sensível a Preço</option>
                <option value="ready" className="bg-black">Pronto</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Multiplicador: <span className="text-white font-semibold">{config.emotionMultipliers[previewEmotion].toFixed(2)}x</span>
              </p>
            </Card>

            {/* Stats */}
            <Card title="Configuração Ativa" icon={Gauge}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Delay base</span>
                  <span className="text-white">{previewDelay}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max bolhas</span>
                  <span className="text-white">{config.stageBehavior[previewStage].maxBubbles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CTA level</span>
                  <span className="text-white capitalize">{config.stageBehavior[previewStage].ctaLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Exige pergunta</span>
                  <span className="text-white">{config.stageBehavior[previewStage].requireQuestion ? "Sim" : "Não"}</span>
                </div>
              </div>
            </Card>

            {/* Quick Tests */}
            <Card title="Testes Rápidos" icon={Zap}>
              <div className="space-y-2">
                {[
                  "Oi, quero saber mais",
                  "Quanto custa?",
                  "Quero agendar uma reunião",
                  "Não tá funcionando!",
                ].map(msg => (
                  <button
                    key={msg}
                    onClick={() => setPreviewInput(msg)}
                    className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-xl flex items-center gap-2 ${
          toast.type === "success"
            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border border-red-500/30 text-red-300"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function Card({ title, icon: Icon, children, className }: { 
  title?: string; 
  icon?: any; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[28px] border border-white/10 bg-white/5 p-6 ${className || ""}`}>
      {title && (
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#f57f17]" />}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function OptionCard({ selected, onClick, title, desc, hint }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition ${
        selected
          ? "border-[#f57f17]/50 bg-[#f57f17]/10"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <p className="text-white font-semibold">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
      {hint && <p className="text-xs text-[#f57f17] mt-1">{hint}</p>}
    </button>
  );
}

function SliderRow({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500">{min} - {max}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24 accent-[#f57f17]"
        />
        <span className="text-white font-semibold w-12 text-right">{value}</span>
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

function StageCard({ stage, icon: Icon, color, title, desc, behavior, onChange }: {
  stage: string;
  icon: any;
  color: "blue" | "yellow" | "orange";
  title: string;
  desc: string;
  behavior: StageBehavior;
  onChange: (b: StageBehavior) => void;
}) {
  const colors = {
    blue: "border-blue-500/30 bg-blue-500/5",
    yellow: "border-yellow-500/30 bg-yellow-500/5",
    orange: "border-[#f57f17]/30 bg-[#f57f17]/5",
  };
  const iconColors = {
    blue: "text-blue-400",
    yellow: "text-yellow-400",
    orange: "text-[#f57f17]",
  };

  return (
    <div className={`rounded-[28px] border ${colors[color]} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${iconColors[color]}`} />
        </div>
        <div>
          <h3 className="text-white font-bold">{title}</h3>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>

      <div className="space-y-4">
        <SliderRow
          label="Máx bolhas"
          value={behavior.maxBubbles}
          min={1}
          max={4}
          onChange={v => onChange({ ...behavior, maxBubbles: v })}
        />

        <ToggleRow
          label="Exigir pergunta"
          desc="Sempre termina com pergunta"
          value={behavior.requireQuestion}
          onChange={v => onChange({ ...behavior, requireQuestion: v })}
        />

        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white font-medium mb-2">Nível do CTA</p>
          <div className="grid grid-cols-3 gap-2">
            {(["soft", "medium", "hard"] as const).map(cta => (
              <button
                key={cta}
                onClick={() => onChange({ ...behavior, ctaLevel: cta })}
                className={`h-9 rounded-lg text-xs font-medium capitalize transition ${
                  behavior.ctaLevel === cta
                    ? "bg-[#f57f17]/20 border border-[#f57f17]/30 text-white"
                    : "bg-white/5 border border-white/10 text-gray-400"
                }`}
              >
                {cta}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmotionCard({ emotion, icon: Icon, label, desc, value, onChange, hint }: {
  emotion: string;
  icon: any;
  label: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5 text-[#f57f17]" />
        <div>
          <p className="text-white font-medium">{label}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-[#f57f17]"
        />
        <span className="text-white font-semibold w-12 text-right">{value.toFixed(2)}x</span>
      </div>
      {hint && <p className="text-xs text-gray-600 mt-2">{hint}</p>}
    </div>
  );
}

function TemplateCard({ intent, title, desc, template, onChange }: {
  intent: string;
  title: string;
  desc: string;
  template: { bubble1: string; bubble2: string };
  onChange: (field: "bubble1" | "bubble2", value: string) => void;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div className="mb-4">
        <h3 className="text-white font-bold">{title}</h3>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Bolha 1</label>
          <textarea
            value={template.bubble1}
            onChange={e => onChange("bubble1", e.target.value)}
            className="w-full h-20 mt-1 p-3 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Bolha 2</label>
          <textarea
            value={template.bubble2}
            onChange={e => onChange("bubble2", e.target.value)}
            className="w-full h-20 mt-1 p-3 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );
}