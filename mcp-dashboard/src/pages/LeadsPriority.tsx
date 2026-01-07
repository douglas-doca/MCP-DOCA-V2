import React, { useMemo } from 'react'
import { useSentimentMatrix } from '../hooks/useEmotionData'

const EMOJI: Record<string, string> = {
  skeptical: '😒',
  anxious: '😰',
  frustrated: '😤',
  excited: '🤩',
  price_sensitive: '💰',
  ready: '✅',
  curious: '🔍',
  neutral: '😐'
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

export function LeadsPriority() {
  const { data, loading, error } = useSentimentMatrix()

  const topLeads = useMemo(() => {
    const arr = data?.data || []
    // score final = health_score + intenção (0..1) * 30 + sentimento (0..1) * 10
    // (só pra ordenar legal)
    return [...arr]
      .map((l) => {
        const intentionBoost = (l.intention ?? 0) * 30
        const sentimentBoost = ((l.sentiment ?? 0) + 1) / 2 * 10
        const finalScore = (l.health_score ?? 0) + intentionBoost + sentimentBoost
        return { ...l, finalScore }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 20)
  }, [data])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center h-[520px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-red-400 font-medium">Erro ao carregar leads prioritários</p>
        {error && <p className="text-gray-500 text-sm mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white">Leads Prioritários</h2>
        <p className="text-gray-400 text-sm">
          Top 20 leads com maior probabilidade de avançar (health + intenção + sentimento)
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-400 font-medium">Lead</th>
              <th className="text-left p-4 text-gray-400 font-medium">Emoção</th>
              <th className="text-left p-4 text-gray-400 font-medium">Stage</th>
              <th className="text-left p-4 text-gray-400 font-medium">Health</th>
              <th className="text-left p-4 text-gray-400 font-medium">Intenção</th>
              <th className="text-left p-4 text-gray-400 font-medium">Sentimento</th>
            </tr>
          </thead>

          <tbody>
            {topLeads.map((lead) => (
              <tr key={lead.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="p-4">
                  <p className="text-white font-medium">{lead.name || lead.phone}</p>
                  <p className="text-gray-500 text-sm">{lead.phone}</p>
                </td>

                <td className="p-4 text-white">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xl">{EMOJI[lead.emotion] || '😐'}</span>
                    <span className="text-gray-300">{lead.emotion}</span>
                  </span>
                </td>

                <td className="p-4 text-gray-300">{lead.stage}</td>

                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold w-10">{lead.health_score}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#f57f17]"
                        style={{ width: `${clamp(lead.health_score)}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="p-4 text-gray-300">{Math.round((lead.intention ?? 0) * 100)}%</td>
                <td className="p-4 text-gray-300">{Math.round(((lead.sentiment ?? 0) + 1) * 50)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
