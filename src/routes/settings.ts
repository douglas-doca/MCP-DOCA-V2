// src/routes/settings.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../services/supabaseAdmin"; // ajuste pro seu projeto

const KeySchema = z.string().min(1).max(120);

export async function getSetting(req: Request, res: Response) {
  const key = KeySchema.safeParse(req.query.key);
  if (!key.success) return res.status(400).json({ error: "Invalid key" });

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key,value")
    .eq("key", key.data)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (!data) return res.status(404).json({ error: "Not found" });

  // value deve ser string JSON
  return res.json({ key: data.key, value: data.value });
}

const SaveSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.any(),
});

export async function saveSetting(req: Request, res: Response) {
  const parsed = SaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const { key, value } = parsed.data;

  // sempre salvar value como string
  const valueString = typeof value === "string" ? value : JSON.stringify(value);

  const { error } = await supabaseAdmin
    .from("settings")
    .upsert({ key, value: valueString }, { onConflict: "key" });

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, key });
}
