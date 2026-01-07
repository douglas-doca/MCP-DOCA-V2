// src/mock/types.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DemoMessage = {
  id: string;
  conversation_id: string;
  from: "lead" | "agent";
  text: string;
  created_at: string;
  meta?: Record<string, any>;
};

export type DemoConversation = {
  id: string;
  phone: string;
  name: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  current_emotion?: string;
  temperature?: number;
  lead_id: string;
  tags?: string[];
  last_message?: string;
};

export type DemoLead = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  source: "whatsapp";
  score: number;
  status: "new" | "active" | "won" | "lost";
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;

  emotion_profile: any;
  health_score: number;
  stage: string;
  urgency_level: "low" | "normal" | "high" | "critical";
  conversion_probability: number;
};

export type DemoEmotionEvent = {
  id: string;
  lead_id: string;
  conversation_id: string;
  emotion: string;
  confidence: number;
  detected_at: string;
  text_excerpt: string;
};

export type DemoStats = {
  total_leads: number;
  avg_health_score: number;
  avg_temperature: number;
  stage_distribution: Record<string, number>;
  urgency_distribution: Record<string, number>;
  total_emotion_events: number;
};

export type DemoData = {
  stats: DemoStats;
  leads: DemoLead[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
  emotionEvents: DemoEmotionEvent[];
};
