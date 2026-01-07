// src/components/SocialProofModal.tsx
import React, { useMemo, useState } from "react";
import { Loader2, Save, Upload, X, Tag, ImageIcon } from "lucide-react";

type Props = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    type: "testimonial" | "case" | "before_after" | "results" | "other";
    suggested_text: string;
    tags: string[];
    best_for_stages: string[];
    best_for_objections: string[];
    file: File | null;
  }) => void;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SocialProofModal({ open, saving, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Props["onSave"] extends any ? any : any>("testimonial");
  const [suggestedText, setSuggestedText] = useState("");
  const [tags, setTags] = useState("");
  const [stages, setStages] = useState("cético, curioso, sensível_preço");
  const [objections, setObjections] = useState("vale a pena, robótico");
  const [file, setFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  if (!open) return null;

  function handleSave() {
    if (!title.trim()) return alert("Título é obrigatório.");
    if (!suggestedText.trim()) return alert("Texto sugerido é obrigatório.");
    if (!file) return alert("Envie uma imagem (print/case).");

    onSave({
      title: title.trim(),
      type,
      suggested_text: suggestedText.trim(),
      tags: splitComma(tags),
      best_for_stages: splitComma(stages),
      best_for_objections: splitComma(objections),
      file,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-black/85 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-lg">Adicionar prova social</p>
            <p className="text-gray-500 text-sm mt-1">
              Prints, cases, depoimentos e resultados — isso aumenta conversão.
            </p>
          </div>

          <button
            onClick={onClose}
            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-gray-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          {/* FORM */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500">Título</p>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full h-11 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                placeholder="Ex: Case — Clínica estética aumentou agenda em 23%"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Tipo</p>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="mt-1 w-full h-11 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                >
                  <option value="testimonial" className="bg-black">Depoimento</option>
                  <option value="case" className="bg-black">Case</option>
                  <option value="before_after" className="bg-black">Antes/Depois</option>
                  <option value="results" className="bg-black">Resultados</option>
                  <option value="other" className="bg-black">Outro</option>
                </select>
              </div>

              <div>
                <p className="text-xs text-gray-500">Tags</p>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 h-11">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600"
                    placeholder="Ex: estética, SLA, agendamento"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500">Texto sugerido (script)</p>
              <textarea
                value={suggestedText}
                onChange={(e) => setSuggestedText(e.target.value)}
                className="mt-1 w-full min-h-[160px] rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm p-3 outline-none resize-none focus:ring-2 focus:ring-[#f57f17]"
                placeholder="Ex: Temos clientes nesse setor que reduziram tempo de resposta de 30min para 2min..."
              />
              <p className="text-gray-600 text-xs mt-2">
                Dica: sempre inclua um número (resultado) + CTA (ex: “quer ver um exemplo?”).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Melhor para estágios</p>
                <input
                  value={stages}
                  onChange={(e) => setStages(e.target.value)}
                  className="mt-1 w-full h-11 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                  placeholder="cético, curioso, pronto..."
                />
              </div>

              <div>
                <p className="text-xs text-gray-500">Quebra objeções</p>
                <input
                  value={objections}
                  onChange={(e) => setObjections(e.target.value)}
                  className="mt-1 w-full h-11 rounded-2xl border border-white/10 bg-black/40 text-gray-200 text-sm px-3 outline-none focus:ring-2 focus:ring-[#f57f17]"
                  placeholder="robótico, vale a pena, preço..."
                />
              </div>
            </div>

            {/* Upload */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-semibold flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#f57f17]" />
                    Upload da imagem
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Pode ser print do WhatsApp, gráfico, print de resultado, etc.
                  </p>
                </div>

                <label className="cursor-pointer h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200 inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Selecionar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFile(f);
                    }}
                  />
                </label>
              </div>

              {file ? (
                <div className="mt-3 text-sm text-gray-300">
                  <span className="text-white font-semibold">Arquivo:</span> {file.name}{" "}
                  <span className="text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">
                  Nenhuma imagem selecionada ainda.
                </div>
              )}
            </div>
          </div>

          {/* PREVIEW */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-white font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              Preview
            </p>
            <p className="text-gray-500 text-sm mt-1">
              O agente vai poder usar isso como prova social.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-[360px] object-cover" />
              ) : (
                <div className="h-[360px] flex items-center justify-center text-gray-600">
                  Selecione uma imagem
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "h-11 w-full rounded-2xl border transition-all flex items-center justify-center gap-2 text-sm font-semibold",
                  saving
                    ? "border-[#f57f17]/20 bg-[#f57f17]/10 text-[#f57f17]/60 cursor-not-allowed"
                    : "border-[#f57f17]/35 bg-[#f57f17]/15 text-white hover:bg-[#f57f17]/20 shadow-[0_0_0_1px_rgba(245,127,23,0.12)]"
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar prova social
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-semibold text-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function splitComma(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
