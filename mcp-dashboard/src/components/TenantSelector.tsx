import { useState, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { getTenants, Tenant } from "../lib/api";

type Props = {
  value: string | null;
  onChange: (tenantId: string | null) => void;
};

export default function TenantSelector({ value, onChange }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await getTenants();
      setTenants(data || []);
    } catch (err) {
      console.error("Failed to load tenants:", err);
    } finally {
      setLoading(false);
    }
  };

  const selected = tenants.find((t) => t.id === value);
  const label = selected ? selected.name : "Todos os Clientes";

  if (loading) {
    return (
      <div className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-2 text-sm text-gray-400">
        <Building2 className="w-4 h-4 animate-pulse" />
        <span>Carregando...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-semibold text-gray-200"
      >
        <Building2 className="w-4 h-4 text-[#f57f17]" />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Selecionar Cliente</h3>
              <p className="text-xs text-gray-500 mt-0.5">Filtrar dados por cliente</p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {/* Opção "Todos" */}
              <button
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between ${
                  !value ? "bg-[#f57f17]/10" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Todos os Clientes</p>
                    <p className="text-xs text-gray-500">Visão geral</p>
                  </div>
                </div>
                {!value && <Check className="w-4 h-4 text-[#f57f17]" />}
              </button>

              {/* Lista de tenants */}
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => {
                    onChange(tenant.id);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between ${
                    value === tenant.id ? "bg-[#f57f17]/10" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#f57f17]/20 flex items-center justify-center">
                      <span className="text-[#f57f17] font-bold text-xs">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium truncate">{tenant.name}</p>
                      <p className="text-xs text-gray-500">{tenant.specialty || tenant.slug}</p>
                    </div>
                  </div>
                  {value === tenant.id && <Check className="w-4 h-4 text-[#f57f17]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
