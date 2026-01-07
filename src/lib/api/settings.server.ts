function resolveBaseUrl() {
  // Preferência: você define isso no ambiente do worker/agente:
  // SITE_URL=https://seusite.com
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl;

  // Vercel: VERCEL_URL vem sem protocolo às vezes
  const vercel = process.env.VERCEL_URL;
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  // fallback local
  return "http://localhost:3000";
}

/**
 * Server-safe:
 * - usa URL absoluta
 * - retorna só a string "value" do setting
 */
export async function getSettingServerValue(key: string): Promise<string | null> {
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/api/settings?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data = await res.json();
  const value = data?.value;

  return typeof value === "string" ? value : null;
}
