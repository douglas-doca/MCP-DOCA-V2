// src/lib/socialProof.ts
import { supabase, isSupabaseEnabled } from "./supabaseClient";

/**
 * ✅ Social Proof Library (Supabase Storage + Table)
 *
 * Storage bucket:
 *  - social-proof
 *
 * Table:
 *  - social_proof_assets
 *
 * Campos esperados pelo SocialProofLibrary.tsx:
 *  - id
 *  - title
 *  - type
 *  - image_path
 *  - suggested_text
 *  - tags
 *  - best_for_stages
 *  - best_for_objections
 *  - source
 *  - created_at
 *  - updated_at
 */

export type SocialProofAssetType =
  | "testimonial"
  | "case"
  | "before_after"
  | "results"
  | "other";

export type SocialProofAsset = {
  id: string;
  title: string;
  type: SocialProofAssetType;

  // storage
  image_path: string;

  // copy
  suggested_text: string;

  // metadata
  tags?: string[] | null;
  best_for_stages?: string[] | null;
  best_for_objections?: string[] | null;

  source?: "demo" | "manual" | "imported" | string | null;

  created_at?: string;
  updated_at?: string;
};

export const SOCIAL_PROOF_BUCKET = "social-proof";
export const SOCIAL_PROOF_TABLE = "social_proof_assets";

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function requireSupabase() {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error(
      "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

function isUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

/**
 * Converte image_path -> URL pública
 * - Se você usar bucket público, isso resolve.
 * - Se você quiser signed URL de verdade (bucket privado), eu troco aqui depois.
 */
export async function getSocialProofSignedUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (isUrl(pathOrUrl)) return pathOrUrl;

  if (!isSupabaseEnabled || !supabase) return pathOrUrl;

  const client = supabase;
  const { data } = client.storage.from(SOCIAL_PROOF_BUCKET).getPublicUrl(pathOrUrl);
  return data?.publicUrl || pathOrUrl;
}

// -----------------------------------------------------
// Storage
// -----------------------------------------------------
/**
 * ✅ Compatível com seu componente:
 * const imagePath = await uploadSocialProofImage(file)
 * -> retorna STRING (path) dentro do bucket
 */
export async function uploadSocialProofImage(file: File, folder = "assets"): Promise<string> {
  const client = requireSupabase();

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeName = file.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_\.]/g, "")
    .toLowerCase();

  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}-${safeName}.${ext}`;

  const { error } = await client.storage.from(SOCIAL_PROOF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

// -----------------------------------------------------
// DB
// -----------------------------------------------------
export async function listSocialProofAssets(): Promise<SocialProofAsset[]> {
  if (!isSupabaseEnabled || !supabase) return [];

  const client = supabase;

  const { data, error } = await client
    .from(SOCIAL_PROOF_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data || []) as SocialProofAsset[];
}

/**
 * ✅ Seu componente faz:
 * const created = await createSocialProofAsset(...)
 * então essa função deve retornar o item criado.
 */
export async function createSocialProofAsset(
  asset: SocialProofAsset
): Promise<SocialProofAsset> {
  const client = requireSupabase();

  const now = new Date().toISOString();

  const payload: SocialProofAsset = {
    ...asset,
    id: asset.id || crypto.randomUUID(),
    title: asset.title || "Sem título",
    type: asset.type || "other",
    image_path: asset.image_path || "",
    suggested_text: asset.suggested_text || "",
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    best_for_stages: Array.isArray(asset.best_for_stages) ? asset.best_for_stages : ["geral"],
    best_for_objections: Array.isArray(asset.best_for_objections) ? asset.best_for_objections : [],
    source: asset.source ?? "manual",
    created_at: asset.created_at ?? now,
    updated_at: asset.updated_at ?? now,
  };

  const { data, error } = await client
    .from(SOCIAL_PROOF_TABLE)
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as SocialProofAsset;
}

/**
 * ✅ Seu componente chama:
 * deleteSocialProofAsset(it.id, it.image_path)
 * então aceitamos (id, image_path)
 */
export async function deleteSocialProofAsset(id: string, image_path?: string): Promise<void> {
  const client = requireSupabase();

  // delete row
  const { error } = await client.from(SOCIAL_PROOF_TABLE).delete().eq("id", id);
  if (error) throw error;

  // delete storage (se tiver)
  if (image_path) {
    try {
      await client.storage.from(SOCIAL_PROOF_BUCKET).remove([image_path]);
    } catch {
      // ignora
    }
  }
}
