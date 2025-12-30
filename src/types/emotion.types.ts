export type EmotionType = 
  | 'skeptical'
  | 'anxious'
  | 'frustrated'
  | 'excited'
  | 'price_sensitive'
  | 'ready'
  | 'curious'
  | 'neutral';

export type LeadStage = 
  | 'cético'
  | 'frustrado'
  | 'curioso'
  | 'sensível_preço'
  | 'empolgado'
  | 'pronto';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';

export interface EmotionEvent {
  id: string;
  conversation_id: string;
  lead_id: string;
  emotion: EmotionType;
  confidence: number;
  message_content: string;
  detected_at: Date;
  metadata: Record<string, any>;
}

export interface EmotionProfile {
  dominant_emotion: EmotionType;
  emotion_distribution: Record<EmotionType, number>;
  emotion_transitions: Array<{from: EmotionType; to: EmotionType; count: number}>;
  last_updated: Date;
}

export interface HealthMetrics {
  health_score: number; // 0-100
  temperature: number; // 0-100 (quão "quente" está o lead)
  conversion_probability: number; // 0-1
  urgency_level: UrgencyLevel;
  friction_points: string[];
  positive_signals: string[];
}