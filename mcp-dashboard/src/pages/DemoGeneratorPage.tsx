import React, { useMemo, useState } from "react";
import { Sparkles, Wand2, Trash2, Copy, Check } from "lucide-react";

import {
  listGeneratedDemos,
  removeGeneratedDemo,
  generateDemoAndStore,
  type DemoNiche,
  type GeneratedDemoSummary,
} from "../mock";

const NICHES: Array<{ key: DemoNiche; label: string; hint: string }> = [
  { key: "default", label: "Padrão DOCA", hint: "Geral / multi-negócio" },
  { key: "clinic", label: "Clínica", hint: "Saúde / estética / procedimentos" },
  { key: "realestate", label: "Imobiliária", hint: "Compra / venda / locação" },
  { key: "aesthetics", label: "Estética", hint: "Studio / beleza / tratamentos" },
  { key: "law", label: "Advocacia", hint: "Consultoria / casos / contratos" },
  { key: "ecommerce", label: "E-commerce", hint: "Loja online / carrinho / ofertas" },
];

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export default function DemoGeneratorPage() {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState<DemoNiche>("clinic");
  const [city, setCity] = useState("São Paulo");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [offer, setOffer] = useState("");
  const [mainPain, setMainPain] = useState("");
  const [objections, setObjections] = useState("preço, confiança");
  const [leadsPerMonth, setLeadsPerMonth] = useState(120);
  const [conversationsCount, setConversationsCount] = useState(60);

  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generated = useMemo(() => listGeneratedDemos(), [lastCreatedKey]);

  function createKey() {
    const base = slugify(businessName || "cliente");
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${base}-${niche}-${y}${m}${d}-${hh}${mm}`.slice(0, 80);
  }

  function handleGenerate() {
    const key = createKey();

    const result = generateDemoAndStore({
      key,
      niche,
      businessName: businessName || "Cliente",
      city,
      instagram,
      website,
      offer,
      mainPain,
      objections,
      leadsPerMonth: Number(leadsPerMonth || 0),
      conversationsCount: Number(conversationsCount || 0),
    });

    setLastCreatedKey(result.key);
  }

  async function handleCopyKey() {
    if (!lastCreatedKey) return;
    try {
      await navigator.clipboard.writeText(lastCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  function handleDelete(item: GeneratedDemoSummary) {
    const ok = confirm(`Remover demo gerada "${item.label}" (${item.key})?`);
    if (!ok) return;

    removeGeneratedDemo(item.key);
    setLastCreatedKey((prev) => (prev === item.key ? null : prev));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-[#f57f17]" />
            Demo Generator
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gere demos completas para o DEV (conversas, leads, mensagens e stats) e faça elas
            aparecerem no dropdown automaticamente.
          </p>
        </div>

        {lastCreatedKey && (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200">
              Última demo:{" "}
              <span className="text-white font-semibold">{lastCreatedKey}</span>
            </span>

            <button
              onClick={handleCopyKey}
              className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
              title="Copiar key"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-[#f57f17]" />
              )}
              {copied ? "Copiado" : "Copiar key"}
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white font-semibold">Dados do cliente</p>
              <p className="text-sm text-gray-500 mt-1">
                Preencha o básico. O gerador cria uma base realista e coerente.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-[#f57f17]/20 bg-[#f57f17]/10 px-3 py-1.5 text-xs font-semibold text-[#f57f17]">
              <Sparkles className="w-4 h-4" />
              DEV-only
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do negócio">
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex: Clínica Capilar Lux"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Nicho">
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value as DemoNiche)}
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              >
                {NICHES.map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.label} — {n.hint}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cidade">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Instagram (opcional)">
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Ex: @clinicacapilarlux"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Site / LP (opcional)">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Ex: https://site.com"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Oferta (opcional)">
              <input
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ex: Avaliação grátis + plano de tratamento"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Dor principal (opcional)" full>
              <input
                value={mainPain}
                onChange={(e) => setMainPain(e.target.value)}
                placeholder="Ex: queda de cabelo + autoestima"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Objeções comuns (separe por vírgula)" full>
              <input
                value={objections}
                onChange={(e) => setObjections(e.target.value)}
                placeholder="Ex: preço, confiança, tempo, parcelamento"
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Leads/mês (aprox.)">
              <input
                type="number"
                value={leadsPerMonth}
                onChange={(e) => setLeadsPerMonth(Number(e.target.value))}
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>

            <Field label="Nº de conversas (mock)">
              <input
                type="number"
                value={conversationsCount}
                onChange={(e) => setConversationsCount(Number(e.target.value))}
                className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
              />
            </Field>
          </div>

          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              className="h-11 px-5 rounded-2xl border border-[#f57f17]/20 bg-[#f57f17]/10 hover:bg-[#f57f17]/15 transition-all flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4 text-[#f57f17]" />
              <span className="text-sm font-semibold text-[#f57f17]">Gerar demo</span>
            </button>

            <span className="text-xs text-gray-500">
              *Isso salva no localStorage do navegador (DEV). Depois a gente pluga no Supabase.*
            </span>
          </div>
        </div>

        {/* Right: list */}
        <div className="xl:col-span-5 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white">Demos geradas</h3>
              <p className="text-sm text-gray-500 mt-1">
                Essas aparecem no dropdown do DEV automaticamente.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
              {generated.length}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {generated.length === 0 ? (
              <div className="text-sm text-gray-500">
                Nenhuma demo gerada ainda. Crie a primeira usando o formulário.
              </div>
            ) : (
              generated.map((d) => (
                <div
                  key={d.key}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:bg-black/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{d.label}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        key: <span className="text-gray-300 font-semibold">{d.key}</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        niche: <span className="text-gray-400">{d.niche}</span> •{" "}
                        <span className="text-gray-500">
                          {new Date(d.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(d)}
                      className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                      title="Excluir demo"
                    >
                      <Trash2 className="w-4 h-4 text-red-300" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Dica: pra abrir uma demo gerada, selecione ela no dropdown do topo e recarregue a página (ou o
            sistema recarrega sozinho se você já estiver em modo demo).
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
