import React from 'react';
import { useEmotionalFunnel } from '../hooks/useEmotionData';

const STAGE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  'cético': { label: 'CÉTICO', color: 'bg-red-500', emoji: '😒' },
  'frustrado': { label: 'FRUSTRADO', color: 'bg-orange-500', emoji: '😤' },
  'curioso': { label: 'CURIOSO', color: 'bg-yellow-500', emoji: '🔍' },
  'sensível_preço': { label: 'SENSÍVEL A PREÇO', color: 'bg-amber-500', emoji: '💰' },
  'empolgado': { label: 'EMPOLGADO', color: 'bg-lime-500', emoji: '🤩' },
  'pronto': { label: 'PRONTO', color: 'bg-green-500', emoji: '✅' }
};

export function EmotionalFunnel() {
  const { data, loading, error } = useEmotionalFunnel();

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
        <p className="text-red-400">Erro ao carregar funil</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.funnel.map(s => s.count));

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Emotional Sales Funnel
      </h2>
      <p className="text-gray-400 text-sm mb-8">
        Distribuição de leads por estágio emocional
      </p>

      <div className="space-y-4">
        {data.funnel.map((stage, index) => {
          const config = STAGE_CONFIG[stage.stage] || { label: stage.stage, color: 'bg-gray-500', emoji: '❓' };
          const width = (stage.count / maxCount) * 100;
          
          return (
            <div key={stage.stage} className="relative">
              {/* Barra do funil */}
              <div className="relative">
                <div 
                  className={`${config.color} rounded-lg p-4 transition-all duration-500 hover:brightness-110`}
                  style={{ width: `${Math.max(width, 20)}%` }}
                >
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.emoji}</span>
                      <div>
                        <p className="font-bold">{config.label}</p>
                        <p className="text-sm opacity-90">{stage.count} Leads</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{stage.count}</p>
                      <p className="text-sm opacity-90">{stage.percentage}%</p>
                    </div>
                  </div>
                </div>
                
                {/* Indicador de posição no funil */}
                {index < data.funnel.length - 1 && (
                  <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2">
                    <div className="text-gray-600 text-2xl">↓</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicador de conversão no final */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-full">
          <span className="text-2xl">🎯</span>
          <span className="font-bold">
            {data.funnel.find(s => s.stage === 'pronto')?.count || 0} LEADS PRONTOS
          </span>
        </div>
      </div>
    </div>
  );
}