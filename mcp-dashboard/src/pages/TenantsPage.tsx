import { useState, useEffect } from "react";
import { Building2, Plus, Pencil, Phone, Settings, MapPin, Briefcase, Search, X, Check, Loader2, Power, CheckCircle2 } from "lucide-react";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  address?: string;
  specialty?: string;
  active: boolean;
  created_at?: string;
};

const API_BASE = "/api";

type TenantsPageProps = {
  onConfigure?: (tenantId: string) => void;
  selectedTenantId?: string | null;
  onSelectTenant?: (tenantId: string | null) => void;
};

export default function TenantsPage({ onConfigure, selectedTenantId, onSelectTenant }: TenantsPageProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tenants`);
      const data = await res.json();
      setTenants(data || []);
    } catch (err) {
      console.error("Error loading tenants:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const openCreateModal = () => {
    setEditingTenant(null);
    setFormName("");
    setFormSlug("");
    setFormPhone("");
    setFormAddress("");
    setFormSpecialty("");
    setModalOpen(true);
  };

  const openEditModal = (tenant: Tenant, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita selecionar ao editar
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormSlug(tenant.slug);
    setFormPhone(tenant.phone || "");
    setFormAddress(tenant.address || "");
    setFormSpecialty(tenant.specialty || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formSlug) return;
    try {
      setSaving(true);
      if (editingTenant) {
        await fetch(`${API_BASE}/tenants?id=${editingTenant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, slug: formSlug, phone: formPhone || null, address: formAddress || null, specialty: formSpecialty || null }),
        });
      } else {
        await fetch(`${API_BASE}/tenants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, slug: formSlug, phone: formPhone || null, address: formAddress || null, specialty: formSpecialty || null }),
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Error saving tenant:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tenant: Tenant, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita selecionar ao toggle
    try {
      await fetch(`${API_BASE}/tenants?id=${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !tenant.active }),
      });
      loadData();
    } catch (err) {
      console.error("Error toggling tenant:", err);
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    if (!tenant.active) return; // Não permite selecionar tenant inativo
    if (onSelectTenant) {
      // Se já está selecionado, deseleciona (volta para "todos")
      if (selectedTenantId === tenant.id) {
        onSelectTenant(null);
      } else {
        onSelectTenant(tenant.id);
      }
    }
  };

  const handleConfigClick = (tenantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConfigure) onConfigure(tenantId);
  };

  const filteredTenants = tenants.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.slug.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#f57f17] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#f57f17]" />
            Gestão de Clientes
          </h2>
          <p className="text-sm text-gray-500 mt-1">{tenants.length} clientes cadastrados</p>
        </div>
        <button onClick={openCreateModal} className="h-10 px-4 rounded-xl bg-[#f57f17] hover:bg-[#ef6c00] text-white font-semibold flex items-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Indicador do cliente selecionado */}
      {onSelectTenant && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="text-sm text-gray-400">Cliente ativo:</div>
          {selectedTenant ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#f57f17]/20 flex items-center justify-center">
                <span className="text-[#f57f17] font-bold text-xs">{selectedTenant.name.substring(0, 2).toUpperCase()}</span>
              </div>
              <span className="text-white font-semibold">{selectedTenant.name}</span>
              <button
                onClick={() => onSelectTenant(null)}
                className="ml-2 text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
              >
                Limpar filtro
              </button>
            </div>
          ) : (
            <span className="text-gray-300">Todos os clientes</span>
          )}
          <div className="ml-auto text-xs text-gray-500">
            Clique em um card para filtrar os dados
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTenants.map((tenant) => {
          const isSelected = selectedTenantId === tenant.id;
          
          return (
            <div
              key={tenant.id}
              onClick={() => handleSelectTenant(tenant)}
              className={`rounded-2xl border bg-white/[0.02] p-5 transition-all ${
                isSelected 
                  ? "border-[#f57f17] ring-2 ring-[#f57f17]/30 bg-[#f57f17]/5" 
                  : tenant.active 
                    ? "border-white/10 hover:border-[#f57f17]/50 cursor-pointer" 
                    : "border-red-500/30 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isSelected ? "bg-[#f57f17]/30" : "bg-[#f57f17]/20"}`}>
                    <span className="text-[#f57f17] font-bold">{tenant.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{tenant.name}</h3>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[#f57f17]" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">@{tenant.slug}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => toggleActive(tenant, e)}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${tenant.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                  title={tenant.active ? "Desativar" : "Ativar"}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2 mb-4">
                {tenant.specialty && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Briefcase className="w-4 h-4" />
                    <span>{tenant.specialty}</span>
                  </div>
                )}
                {tenant.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{tenant.phone}</span>
                  </div>
                )}
                {tenant.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{tenant.address}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={(e) => openEditModal(tenant, e)}
                  className="flex-1 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-gray-300 flex items-center justify-center gap-2 transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                {onConfigure && (
                  <button
                    onClick={(e) => handleConfigClick(tenant.id, e)}
                    className="flex-1 h-9 rounded-lg border border-[#f57f17]/30 bg-[#f57f17]/10 hover:bg-[#f57f17]/20 text-sm text-[#f57f17] flex items-center justify-center gap-2 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Config
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-xl">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{editingTenant ? "Editar Cliente" : "Novo Cliente"}</h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Empresa</label>
                  <input type="text" value={formName} onChange={(e) => { setFormName(e.target.value); if (!editingTenant) setFormSlug(generateSlug(e.target.value)); }} className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50" placeholder="Ex: Clínica Dr. Hair" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
                  <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50" placeholder="clinica-dr-hair" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Especialidade</label>
                  <input type="text" value={formSpecialty} onChange={(e) => setFormSpecialty(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50" placeholder="Transplante Capilar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Telefone</label>
                  <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50" placeholder="+55 31 99999-9999" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Endereço</label>
                  <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50" placeholder="Rua, número, cidade" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 font-medium">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !formName || !formSlug} className="h-10 px-4 rounded-xl bg-[#f57f17] hover:bg-[#ef6c00] text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingTenant ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}