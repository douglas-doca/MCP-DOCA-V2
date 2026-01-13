import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  address?: string;
  specialty?: string;
  agent_config?: any;
  zapi_config?: any;
}

interface UserProfile {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  tenant?: Tenant;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar perfil do usuário
  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select(`
          *,
          tenant:tenants(*)
        `)
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Erro ao carregar perfil:", error);
        return;
      }

      if (data) {
        setProfile(data);
        setTenant(data.tenant);
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    }
  }

  // Inicializar auth
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Timeout de 5 segundos
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();

        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as { data: { session: Session | null } };

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (event === "SIGNED_IN" && session?.user) {
          await loadProfile(session.user.id);
        } else if (event === "SIGNED_OUT") {
          setProfile(null);
          setTenant(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Login
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  // Cadastro
  async function signUp(email: string, password: string, name: string) {
    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Erro ao criar usuário");

    // 2. Buscar tenant padrão (ou criar lógica de convite)
    const { data: defaultTenant } = await supabase
      .from("tenants")
      .select("id")
      .limit(1)
      .single();

    // 3. Criar perfil do usuário
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        email,
        name,
        tenant_id: defaultTenant?.id,
        role: "user",
      });

    if (profileError) throw profileError;
  }

  // Logout
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // Atualizar perfil
  async function updateProfile(data: Partial<UserProfile>) {
    if (!user) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("user_profiles")
      .update(data)
      .eq("id", user.id);

    if (error) throw error;

    // Recarregar perfil
    await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tenant,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}