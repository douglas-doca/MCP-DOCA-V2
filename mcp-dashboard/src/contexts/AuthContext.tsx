import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  address?: string;
  specialty?: string;
  plan?: string;
  plan_limits?: any;
  agent_config?: any;
  business_hours?: any;
  active?: boolean;
  created_at?: string;
}

export interface UserPermissions {
  conversations?: { view?: boolean; reply?: boolean; delete?: boolean };
  leads?: { view?: boolean; edit?: boolean; delete?: boolean };
  settings?: { view?: boolean; edit?: boolean };
  users?: { view?: boolean; manage?: boolean };
  reports?: { view?: boolean; export?: boolean };
  tenants?: { view?: boolean; manage?: boolean };
}

export interface UserProfile {
  id: string;
  auth_id?: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: "super_admin" | "tenant_admin" | "manager" | "agent" | "viewer" | "admin" | "user";
  avatar_url?: string;
  permissions?: UserPermissions;
  preferences?: any;
  tenant?: Tenant;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  tenant: Tenant | null;
  availableTenants: Tenant[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string | null) => void;
  isSuperAdmin: boolean;
  canManage: (resource: keyof UserPermissions, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  
  const mounted = useRef(true);
  const profileLoaded = useRef(false);

  const isSuperAdmin = (profile?.role === "super_admin" || profile?.role === "admin") && !profile?.tenant_id;

  // Carrega perfil com timeout
  async function loadProfile(authUser: User) {
    if (profileLoaded.current) {
      console.log("✓ Perfil já carregado");
      setLoading(false);
      return;
    }

    console.log("🔄 Carregando perfil para:", authUser.email);
    
    // Timeout de 10 segundos
    const timeoutId = setTimeout(() => {
      if (mounted.current && !profileLoaded.current) {
        console.error("⏰ Timeout ao carregar perfil");
        setError("Timeout ao carregar perfil. Tente novamente.");
        setLoading(false);
      }
    }, 10000);

    try {
      // Query por auth_id
      const { data, error: queryError } = await supabase
        .from("user_profiles")
        .select("*, tenant:tenants(*)")
        .eq("auth_id", authUser.id)
        .maybeSingle();

      clearTimeout(timeoutId);
      
      if (!mounted.current) return;

      console.log("📡 Query resultado:", { data: !!data, error: queryError?.message });

      if (queryError) {
        throw new Error(queryError.message);
      }

      let profileData = data;

      // Se não achou por auth_id, tenta por email
      if (!profileData && authUser.email) {
        console.log("📡 Tentando por email...");
        const { data: emailData, error: emailError } = await supabase
          .from("user_profiles")
          .select("*, tenant:tenants(*)")
          .eq("email", authUser.email)
          .maybeSingle();

        if (emailError) throw new Error(emailError.message);
        
        if (emailData) {
          // Atualiza auth_id
          await supabase
            .from("user_profiles")
            .update({ auth_id: authUser.id })
            .eq("id", emailData.id);
          profileData = emailData;
        }
      }

      if (!profileData) {
        throw new Error("Perfil não encontrado. Contate o administrador.");
      }

      console.log("✅ Perfil carregado:", profileData.name);
      
      profileLoaded.current = true;
      setProfile(profileData);
      setTenant(profileData.tenant || null);
      setError(null);

      // Carrega tenants se admin
      const isAdmin = (profileData.role === "super_admin" || profileData.role === "admin") && !profileData.tenant_id;
      if (isAdmin) {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("*")
          .eq("active", true)
          .order("name");
        setAvailableTenants(tenants || []);
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("❌ Erro:", err.message);
      if (mounted.current) {
        setError(err.message);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  // Inicialização
  useEffect(() => {
    mounted.current = true;
    console.log("🚀 AuthProvider iniciando...");

    // Listener de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("🔔 Auth event:", event);

        if (event === "SIGNED_OUT" || !currentSession) {
          console.log("👋 Logout");
          setUser(null);
          setProfile(null);
          setSession(null);
          setTenant(null);
          setAvailableTenants([]);
          profileLoaded.current = false;
          setLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          setSession(currentSession);
          return;
        }

        // SIGNED_IN ou INITIAL_SESSION
        setSession(currentSession);
        setUser(currentSession.user);
        
        if (!profileLoaded.current) {
          loadProfile(currentSession.user);
        } else {
          setLoading(false);
        }
      }
    );

    // Verifica sessão inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log("📋 Sessão inicial:", initialSession ? "sim" : "não");
      if (!initialSession) {
        setLoading(false);
      }
      // Se tiver sessão, o onAuthStateChange vai tratar
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign In
  async function signIn(email: string, password: string) {
    setError(null);
    setLoading(true);
    profileLoaded.current = false;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      throw error;
    }
  }

  // Sign Out
  async function signOut() {
    profileLoaded.current = false;
    setUser(null);
    setProfile(null);
    setSession(null);
    setTenant(null);
    setAvailableTenants([]);
    setError(null);
    
    // Limpa storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("sb-") || key.includes("supabase")) {
        localStorage.removeItem(key);
      }
    });
    
    await supabase.auth.signOut();
  }

  // Switch Tenant
  function switchTenant(tenantId: string | null) {
    if (!isSuperAdmin) return;
    const found = tenantId ? availableTenants.find(t => t.id === tenantId) : null;
    setTenant(found || null);
  }

  // Can Manage
  function canManage(resource: keyof UserPermissions, action: string): boolean {
    if (!profile) return false;
    if (profile.role === "super_admin" || profile.role === "admin") return true;
    const perms = profile.permissions?.[resource];
    return perms ? (perms as any)[action] === true : false;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        error,
        tenant,
        availableTenants,
        signIn,
        signOut,
        switchTenant,
        isSuperAdmin,
        canManage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}