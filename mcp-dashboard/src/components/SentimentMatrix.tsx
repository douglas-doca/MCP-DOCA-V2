import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { useSentimentMatrix } from '../hooks/useEmotionData';

// Mapeamento de emoções para emojis
const EMOTION_EMOJI: Record<string, string> = {
  skeptical: '😒',
  anxious: '😰',
  frustrated: '😤',
  excited: '🤩',
  price_sensitive: '💰',
  ready: '✅',
  curious: '🔍',
  neutral: '😐'
};

// Cores por emoção
const EMOTION_COLOR: Record<string, string> = {
  skeptical: '#ef4444',
  anxious: '#f59e0b',
  frustrated: '#dc2626',
  excited: '#10b981',
  price_sensitive: '#f97316',
  ready: '#22c55e',
  curious: '#3b82f6',
  neutral: '#6b7280'
};

export function SentimentMatrix() {
  const { data, loading, error } = useSentimentMatrix();

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-red-400">Erro ao carregar matriz</p>
      </div>
    );
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const emoji = EMOTION_EMOJI[payload.emotion] || '😐';
    
    return (
      <text 
        x={cx} 
        y={cy} 
        textAnchor="middle" 
        dominantBaseline="middle"
        fontSize="20"
        style={{ cursor: 'pointer' }}
      >
        {emoji}
      </text>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Sentiment vs. Intention Matrix
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Visualização dos leads por emoção e intenção de compra
      </p>
      
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            type="number" 
            dataKey="sentiment" 
            name="Sentimento" 
            domain={[-1, 1]}
            label={{ value: 'Sentimento', position: 'bottom', fill: '#9ca3af' }}
            stroke="#9ca3af"
          />
          <YAxis 
            type="number" 
            dataKey="intention" 
            name="Intenção" 
            domain={[0, 1]}
            label={{ value: 'Intenção por Quadrante', angle: -90, position: 'left', fill: '#9ca3af' }}
            stroke="#9ca3af"
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
                    <p className="text-white font-semibold">{data.name || data.phone}</p>
                    <p className="text-sm text-gray-400">Emoção: {EMOTION_EMOJI[data.emotion]} {data.emotion}</p>
                    <p className="text-sm text-gray-400">Stage: {data.stage}</p>
                    <p className="text-sm text-orange-400">Health Score: {data.health_score}/100</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter 
            name="Leads" 
            data={data.data} 
            shape={<CustomDot />}
          />
          
          {/* Linhas de quadrantes */}
          <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#4b5563" strokeWidth={1} strokeDasharray="5 5" />
          <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#4b5563" strokeWidth={1} strokeDasharray="5 5" />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legenda */}
      <div className="mt-6 grid grid-cols-4 gap-3">
        {Object.entries(EMOTION_EMOJI).map(([emotion, emoji]) => (
          <div key={emotion} className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <span className="text-sm text-gray-400 capitalize">{emotion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}