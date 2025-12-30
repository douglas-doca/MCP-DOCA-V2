import { useState, useEffect } from 'react';

const API_URL = '/api';

interface DashboardMetrics {
  total_leads: number;
  avg_health_score: number;
  avg_temperature: number;
  stage_distribution: Record<string, number>;
  urgency_distribution: Record<string, number>;
  total_emotion_events: number;
}

interface SentimentMatrixData {
  data: Array<{
    id: string;
    phone: string;
    name: string;
    emotion: string;
    sentiment: number;
    intention: number;
    health_score: number;
    stage: string;
  }>;
}

interface EmotionalFunnelData {
  funnel: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
}

export function useDashboardMetrics() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/dashboard/metrics`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useSentimentMatrix() {
  const [data, setData] = useState<SentimentMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/dashboard/sentiment-matrix`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useEmotionalFunnel() {
  const [data, setData] = useState<EmotionalFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/dashboard/emotional-funnel`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}