// src/components/SocialProofLibrary.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ImageIcon,
  Plus,
  Trash2,
  Copy,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import SocialProofModal from "./SocialProofModal";
import {
  SocialProofAsset,
  createSocialProofAsset,
  deleteSocialProofAsset,
  getSocialProofSignedUrl,
  listSocialProofAssets,
  uploadSocialProofImage,
} from "../lib/socialProof";
import { isDemoMode } from "../mock";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function badge(type: SocialProofAsset["type"]) {
  const map: Record<string, string> = {
    testimonial: "bg-emerald-500/10 border-emerald-400/20 text-emerald-200",
    case: "bg-cyan-500/10 border-cyan-400/20 text-cyan-200",
    before_after: "bg-fuchsia-500/10 border-fuchsia-400/20 text-fuchsia-200",
    results: "bg-yellow-500/10 border-yellow-400/20 text-yellow-200",
    other: "bg-white/5 border-white/10 text-gray-200",
  };
  return map[type] || map.other;
}

export default function SocialProofLibrary() {
  const demoMode = useMemo(() => isDemoMode(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SocialProofAsset[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | SocialProofAsset["type"]>("all");
  const [modalOpen, setModalOpen] = useState(false);

  // URLs assinadas (cache)
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);
      const list = await listSocialProofAssets();
      setItems(list);

      // carregar signed urls em paralelo
      const nextMap: Record<string, string> = {};
      await Promise.all(
        list.map(async (it) => {
          if (!it.image_path) return;
          try {
            const url = await getSocialProofSignedUrl(it.image_path);
            if (url) nextMap[it.id] = url;
          } catch {
            // ignora
          }
        })
      );

      setUrlMap(nextMap);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (type !== "all" && it.type !== type) return false;
      if (!q) return true;

      const hay = `${it.title}\n${it.suggested_text}\n${(it.tags || []).join(" ")}\n${(it.best_for_objections || []).join(" ")}\n${(it.best_for_stages || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, type]);

  async function onCreate(data: {
    title: string;
    type: SocialProofAsset["type"];
    suggested_text: string;
    tags: string[];
    best_for_stages: string[];
    best_for_objections: string[];
    file: File | null;
  }) {
    try {
      setSaving(true);

      const imagePath = data.file ? await uploadSocialProofImage(data.file) : "";

      const created = await createSocialProofAsset({
        title: data.title,
        type: data.type,
        suggested_text: data.suggested_text,
        tags: data.tags,
        best_for_stages: data.best_for_stages.length ? data.best_for_stages : ["geral"],
        best_for_objections: data.best_for_objections,
        image_path: imagePath,
        source: demoMode ? "demo" : "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      // pega url
      let url = "";
      if (created.image_path) {
        try {
          url = await getSocialProofSignedUrl(created.image_path);
        } catch {}
      }

      setItems((prev) => [created, ...prev]);
      if (url) setUrlMap((m) => ({ ...m, [created.id]: url }));

      setModalOpen(false);
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar prova social");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(it: SocialProofAsset) {
    const ok = window.confirm("Remover esta prova social?");
    if (!ok) return;

    try {
      await deleteSocialProofAsset(it.id, it.image_path);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      setUrlMap((m) => {
        const copy = { ...m };
        delete copy[it.id];
        return copy;
      });
    } catch (e: any) {
      alert(e?.message || "Erro ao remover");
    }
  }

  async function onCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Script copiado ✅");
    } catch {
      alert("Não consegui copiar. Copie manualmente.");
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="p-6">
        {/* header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white font-semibold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#f57f17]" />
              Prova Social
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Biblioteca de prints, cases e resultados para o agente usar como “conviction engine”.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="h-10 px-4 rounded-2xl border border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 transition-all flex items-center gap-2 text-sm font-semibold shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* controls */}
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, tags, objeções..."
              className="w-full h-10 rounded-2xl bg-white/5 border border-white/10 pl-10 pr-3 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#f57f17] focus:border-transparent"
            />
          </div>

          <div className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-2 text-sm text-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="bg-transparent outline-none text-gray-200"
            >
              <option value="all" className="bg-black">Todos</option>
              <option value="testimonial" className="bg-black">Depoimento</option>
              <option value="case" className="bg-black">Case</option>
              <option value="before_after" className="bg-black">Antes/Depois</option>
              <option value="results" className="bg-black">Resultados</option>
              <option value="other" className="bg-black">Outro</option>
            </select>
          </div>

          <div className="text-xs text-gray-500">
            {filtered.length} itens {demoMode ? "• DEMO" : ""}
          </div>
        </div>

        {/* list */}
        <div className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando provas sociais…
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-6 text-center">
              <p className="text-white font-semibold">Nenhuma prova social ainda</p>
              <p className="text-gray-500 text-sm mt-1">
                Adicione prints e cases. Isso vira seu maior motor de conversão.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 transition-all text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Adicionar agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((it) => {
                const url = urlMap[it.id] || "";
                return (
                  <div
                    key={it.id}
                    className="rounded-[22px] border border-white/10 bg-black/30 hover:bg-black/35 transition-all overflow-hidden"
                  >
                    {/* image */}
                    <div className="h-[220px] bg-black/40 border-b border-white/10 overflow-hidden">
                      {url ? (
                        <img src={url} alt={it.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-600">
                          Sem imagem (adicione um print)
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">{it.title}</p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "text-[11px] font-semibold px-3 py-1 rounded-full border",
                                badge(it.type)
                              )}
                            >
                              {labelType(it.type)}
                            </span>

                            {(it.tags || []).slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-200"
                              >
                                #{t}
                              </span>
                            ))}

                            {(it.tags || []).length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{(it.tags || []).length - 3}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onCopy(it.suggested_text)}
                            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                            title="Copiar script"
                          >
                            <Copy className="w-4 h-4 text-gray-200" />
                          </button>

                          <button
                            onClick={() => onDelete(it)}
                            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4 text-red-300" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3">
                        <p className="text-xs text-gray-500">Script</p>
                        <p className="text-sm text-gray-200 mt-1 line-clamp-4 whitespace-pre-wrap">
                          {it.suggested_text}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniPill label="Estágios" value={(it.best_for_stages || []).slice(0, 3).join(", ") || "geral"} />
                        <MiniPill label="Objeções" value={(it.best_for_objections || []).slice(0, 3).join(", ") || "—"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SocialProofModal
        open={modalOpen}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={onCreate}
      />
    </div>
  );
}

function labelType(type: SocialProofAsset["type"]) {
  const map: Record<string, string> = {
    testimonial: "Depoimento",
    case: "Case",
    before_after: "Antes/Depois",
    results: "Resultados",
    other: "Outro",
  };
  return map[type] || "Outro";
}

function MiniPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xs text-gray-200 font-semibold mt-0.5">{value}</p>
    </div>
  );
}
