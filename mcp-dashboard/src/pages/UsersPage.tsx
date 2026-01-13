import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, Building2, Shield, User, Mail, Search, X, Check, Loader2 } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "user";
  tenant_id: string;
  tenant?: Tenant;
  avatar_url?: string;
  created_at?: string;
};

const API_BASE = "/api";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: "Admin", color: "text-red-400", bg: "bg-red-500/20" },
  manager: { label: "Gerente", color: "text-amber-400", bg: "bg-amber-500/20" },
  user: { label: "Usuário", color: "text-blue-400", bg: "bg-blue-500/20" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTenant, setFilterTenant] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<string>("user");
  const [formTenantId, setFormTenantId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, tenantsRes] = await Promise.all([
        fetch(`${API_BASE}/users`),
        fetch(`${API_BASE}/tenants`),
      ]);
      
      const usersData = await usersRes.json();
      const tenantsData = await tenantsRes.json();
      
      setUsers(usersData || []);
      setTenants(tenantsData || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("user");
    setFormTenantId(tenants[0]?.id || "");
    setModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormTenantId(user.tenant_id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formEmail || !formTenantId) return;
    
    try {
      setSaving(true);
      
      if (editingUser) {
        // Update
        await fetch(`${API_BASE}/users?id=${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            role: formRole,
            tenant_id: formTenantId,
          }),
        });
      } else {
        // Create
        await fetch(`${API_BASE}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            role: formRole,
            tenant_id: formTenantId,
          }),
        });
      }
      
      setModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Error saving user:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (!confirm(`Deseja remover ${user.name}?`)) return;
    
    try {
      await fetch(`${API_BASE}/users?id=${user.id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  // Filtros
  const filteredUsers = users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterTenant && u.tenant_id !== filterTenant) return false;
    if (filterRole && u.role !== filterRole) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#f57f17] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#f57f17]" />
            Gestão de Usuários
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} usuários cadastrados
          </p>
        </div>
        
        <button
          onClick={openCreateModal}
          className="h-10 px-4 rounded-xl bg-[#f57f17] hover:bg-[#ef6c00] text-white font-semibold flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
          />
        </div>
        
        <select
          value={filterTenant || ""}
          onChange={(e) => setFilterTenant(e.target.value || null)}
          className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
        >
          <option value="">Todos os Clientes</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        
        <select
          value={filterRole || ""}
          onChange={(e) => setFilterRole(e.target.value || null)}
          className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
        >
          <option value="">Todos os Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Gerente</option>
          <option value="user">Usuário</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Usuário</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Role</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.user;
                return (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#f57f17]/20 flex items-center justify-center">
                          <span className="text-[#f57f17] font-bold text-sm">
                            {user.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-300">
                          {user.tenant?.name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${roleInfo.bg} ${roleInfo.color}`}>
                        <Shield className="w-3 h-3" />
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-xl">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
                    placeholder="Nome completo"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f57f17]/50"
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Cliente</label>
                  <select
                    value={formTenantId}
                    onChange={(e) => setFormTenantId(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                  >
                    <option value="">Selecione...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#f57f17]/50"
                  >
                    <option value="user">Usuário</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName || !formEmail || !formTenantId}
                  className="h-10 px-4 rounded-xl bg-[#f57f17] hover:bg-[#ef6c00] text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingUser ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
