import type { DemoData } from "../types";
import type { DemoNiche } from "./index";

export type GeneratedDemoSummary = {
  key: string;
  label: string;
  niche: DemoNiche;
  createdAt: number;
};

const LIST_KEY = "doca:demo:list";
const DEMO_KEY = (key: string) => `doca:demo:${key}`;

function safeJsonParse<T>(v: string | null): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function listGeneratedDemos(): GeneratedDemoSummary[] {
  const list = safeJsonParse<GeneratedDemoSummary[]>(localStorage.getItem(LIST_KEY)) || [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveGeneratedDemo(
  key: string,
  data: DemoData,
  meta: { label: string; niche: DemoNiche }
) {
  // salva o demo
  localStorage.setItem(DEMO_KEY(key), JSON.stringify(data));

  // atualiza lista
  const list = listGeneratedDemos();
  const next: GeneratedDemoSummary[] = [
    {
      key,
      label: meta.label || key,
      niche: meta.niche,
      createdAt: Date.now(),
    },
    ...list.filter((i) => i.key !== key),
  ];

  localStorage.setItem(LIST_KEY, JSON.stringify(next.slice(0, 50)));
}

export function loadGeneratedDemo(key: string): DemoData | null {
  return safeJsonParse<DemoData>(localStorage.getItem(DEMO_KEY(key)));
}

export function deleteGeneratedDemo(key: string) {
  localStorage.removeItem(DEMO_KEY(key));
  const list = listGeneratedDemos().filter((i) => i.key !== key);
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}
