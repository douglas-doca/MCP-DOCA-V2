import React, { useEffect, useMemo, useState } from "react";

type PlanItem =
  | { type: "typing"; action: "start" | "stop"; delayMs: number }
  | { type: "text"; text: string; delayMs: number };

type Plan = {
  items: PlanItem[];
  bubbles: string[];
  meta: {
    intention: string;
    emotion: string;
    stage: string;
    mode: string;
  };
};

export default function AgentStudio() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");

  // Simulador
  const [simMessage, setSimMessage] = useState("quanto custa?");
  const [simStage, setSimStage] = useState("cold");
  const [simEmotion, setSimEmotion] = useState("neutral");
  const [simIntention, setSimIntention] = useState("orcamento");
  const [simPlan, setSimPlan] = useState<Plan | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  async function fetchCfg() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/humanizer-config");
      const data = await res.json();
      setCfg(data.value);
      setJsonDraft(JSON.stringify(data.value, null, 2));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCfg();
  }, []);

  const h = cfg?.humanizer || {};
  const delay = h?.delay || {};

  const canSave = useMemo(() => {
    if (!cfg) return false;
    return true;
  }, [cfg]);

  async function saveCfg() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/humanizer-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (!data.ok) {
        alert("Erro ao salvar: " + data.error);
        return;
      }
      alert("Config salva ✅");
      await fetchCfg();
    } finally {
      setSaving(false);
    }
  }

  async function runSim() {
    setSimLoading(true);
    try {
      const res = await fetch("/api/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: simMessage,
          stage: simStage,
          emotion: simEmotion,
          intention: simIntention,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert("Erro ao simular: " + data.error);
        return;
      }
      setSimPlan(data.plan);
    } finally {
      setSimLoading(false);
    }
  }

  function update(path: string, value: any) {
    setCfg((prev: any) => {
      const clone = structuredClone(prev || {});
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = obj[keys[i]] ?? {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      setJsonDraft(JSON.stringify(clone, null, 2));
      return clone;
    });
  }

  function applyJsonDraft() {
    try {
      const parsed = JSON.parse(jsonDraft);
      setCfg(parsed);
      alert("JSON aplicado ✅");
    } catch (e: any) {
      alert("JSON inválido: " + e.message);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando Agent Studio…</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Agent Studio</h1>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={jsonMode} onChange={(e) => setJsonMode(e.target.checked)} />
            Editar em JSON
          </label>

          <button
            disabled={!canSave || saving}
            onClick={saveCfg}
            style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
          >
            {saving ? "Salvando…" : "Salvar Config"}
          </button>
        </div>
      </div>

      {/* CONFIG */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* FORM */}
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Humanizer</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <Row label="Max bolhas">
              <input
                type="number"
                value={h.maxBubbles ?? 2}
                min={1}
                max={4}
                onChange={(e) => update("humanizer.maxBubbles", Number(e.target.value))}
              />
            </Row>

            <Row label="Máx frases por bolha">
              <input
                type="number"
                value={h.maxSentencesPerBubble ?? 2}
                min={1}
                max={4}
                onChange={(e) => update("humanizer.maxSentencesPerBubble", Number(e.target.value))}
              />
            </Row>

            <Row label="Máx emojis por bolha">
              <input
                type="number"
                value={h.maxEmojiPerBubble ?? 1}
                min={0}
                max={2}
                onChange={(e) => update("humanizer.maxEmojiPerBubble", Number(e.target.value))}
              />
            </Row>

            <hr />

            <h3 style={{ margin: "8px 0 0" }}>Delay</h3>

            <Row label="Base (ms)">
              <input
                type="number"
                value={delay.base ?? 450}
                min={0}
                max={3000}
                onChange={(e) => update("humanizer.delay.base", Number(e.target.value))}
              />
            </Row>

            <Row label="Por caractere (ms)">
              <input
                type="number"
                value={delay.perChar ?? 18}
                min={0}
                max={80}
                onChange={(e) => update("humanizer.delay.perChar", Number(e.target.value))}
              />
            </Row>

            <Row label="Cap (ms)">
              <input
                type="number"
                value={delay.cap ?? 1750}
                min={0}
                max={5000}
                onChange={(e) => update("humanizer.delay.cap", Number(e.target.value))}
              />
            </Row>

            <hr />

            <Row label="Salvar chunks no DB">
              <input
                type="checkbox"
                checked={!!h.saveChunksToDB}
                onChange={(e) => update("humanizer.saveChunksToDB", e.target.checked)}
              />
            </Row>

            <Row label="Salvar typing chunks">
              <input
                type="checkbox"
                checked={!!h.saveTypingChunks}
                onChange={(e) => update("humanizer.saveTypingChunks", e.target.checked)}
              />
            </Row>
          </div>
        </div>

        {/* JSON EDITOR */}
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Config JSON</h2>

          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            style={{ width: "100%", height: 520, fontFamily: "monospace", fontSize: 12, padding: 12, borderRadius: 12 }}
            disabled={!jsonMode}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <button
              disabled={!jsonMode}
              onClick={applyJsonDraft}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              Aplicar JSON
            </button>
            <button
              onClick={() => setJsonDraft(JSON.stringify(cfg, null, 2))}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              Recarregar do Form
            </button>
          </div>
        </div>
      </div>

      {/* SIMULADOR */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Simulador</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Mensagem do cliente
              <input
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10 }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                Stage
                <select value={simStage} onChange={(e) => setSimStage(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
                  <option value="cold">cold</option>
                  <option value="warm">warm</option>
                  <option value="hot">hot</option>
                </select>
              </label>

              <label>
                Emoção
                <select value={simEmotion} onChange={(e) => setSimEmotion(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
                  <option value="neutral">neutral</option>
                  <option value="anxious">anxious</option>
                  <option value="skeptical">skeptical</option>
                  <option value="frustrated">frustrated</option>
                  <option value="excited">excited</option>
                </select>
              </label>
            </div>

            <label>
              Intenção
              <select value={simIntention} onChange={(e) => setSimIntention(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
                <option value="primeiro_contato">primeiro_contato</option>
                <option value="cliente_bravo">cliente_bravo</option>
                <option value="orcamento">orcamento</option>
                <option value="agendamento">agendamento</option>
                <option value="curiosidade">curiosidade</option>
                <option value="outros">outros</option>
              </select>
            </label>

            <button
              onClick={runSim}
              disabled={simLoading}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              {simLoading ? "Simulando…" : "Simular"}
            </button>

            {simPlan && (
              <div style={{ fontSize: 12, color: "#555" }}>
                <div><b>mode:</b> {simPlan.meta.mode}</div>
                <div><b>bubbles:</b> {simPlan.bubbles.length}</div>
              </div>
            )}
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Preview WhatsApp</h2>

          <div style={{ background: "#f5f5f5", borderRadius: 16, padding: 16, minHeight: 340 }}>
            {/* user bubble */}
            <Bubble side="right" text={simMessage || "…"} />

            {simPlan?.bubbles?.map((b, idx) => (
              <Bubble key={idx} side="left" text={b} />
            ))}

            {!simPlan && (
              <div style={{ opacity: 0.6, fontSize: 13 }}>
                Clique em <b>Simular</b> para ver como o agente responderia.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 13, opacity: 0.8 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Bubble({ side, text }: { side: "left" | "right"; text: string }) {
  const align = side === "left" ? "flex-start" : "flex-end";
  const bg = side === "left" ? "white" : "#DCF8C6";
  return (
    <div style={{ display: "flex", justifyContent: align, marginBottom: 10 }}>
      <div
        style={{
          maxWidth: "82%",
          background: bg,
          padding: "10px 12px",
          borderRadius: 14,
          fontSize: 14,
          whiteSpace: "pre-wrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
        }}
      >
        {text}
      </div>
    </div>
  );
}
