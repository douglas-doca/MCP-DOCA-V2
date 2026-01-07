export function formatDate(input?: string | number | Date | null): string {
  if (!input) return "—";

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "—";
    return input.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (typeof input === "number") {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const normalized = String(input)
    .trim()
    .replace(/\+00:00$/, "Z") // supabase costuma vir assim
    .replace(" ", "T");       // se vier "2026-01-06 06:00:58"

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
