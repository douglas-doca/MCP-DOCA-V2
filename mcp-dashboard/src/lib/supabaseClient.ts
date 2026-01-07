// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string | null {
  // Vite: import.meta.env
  // (evita quebrar em runtime se a env não existir)
  const v = (import.meta as any)?.env?.[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

// ✅ IMPORTANT:
// Se não houver env vars (demo/local), não cria client.
// Assim o app não explode e você pode fallback pra mocks/localStorage.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

// ✅ Helper (útil pros componentes)
export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);
