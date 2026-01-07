import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSentimentMatrix } from "../hooks/useEmotionData";

const EMOTION_EMOJI: Record<string, string> = {
  skeptical: "😒",
  anxious: "😰",
  frustrated: "😤",
  excited: "🤩",
  price_sensitive: "💰",
  ready: "✅",
  curious: "🔍",
  neutral: "😐",
};

export default function SentimentMatrix() {
  const { data, loading, error } = useSentimentMatrix();

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center h-[520px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f57f17]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-red-400 font-medium">Erro ao carregar matriz</p>
        {error && <p className="text-gray-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const emoji = EMOTION_EMOJI[payload.emotion] || "😐";
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="20"
        style={{ cursor: "pointer" }}
      >
        {emoji}
      </text>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-2">
        Sentiment vs. Intention Matrix
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Visualização dos leads por emoção e intenção de compra
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 50, left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <ReferenceLine x={0} stroke="#4b5563" strokeDasharray="5 5" />
          <ReferenceLine y={0.5} stroke="#4b5563" strokeDasharray="5 5" />

          <XAxis
            type="number"
            dataKey="sentiment"
            domain={[-1, 1]}
            stroke="#9ca3af"
            label={{
              value: "Sentimento",
              position: "bottom",
              fill: "#9ca3af",
            }}
          />
          <YAxis
            type="number"
            dataKey="intention"
            domain={[0, 1]}
            stroke="#9ca3af"
            label={{
              value: "Intenção",
              angle: -90,
              position: "left",
              fill: "#9ca3af",
            }}
          />

          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d: any = payload[0].payload;
                return (
                  <div className="bg-black border border-gray-700 rounded-xl p-3 shadow-xl">
                    <p className="text-white font-semibold">
                      {d.name || d.phone}
                    </p>
                    <p className="text-sm text-gray-400">
                      Emoção: {EMOTION_EMOJI[d.emotion] || "😐"} {d.emotion}
                    </p>
                    <p className="text-sm text-gray-400">Stage: {d.stage}</p>
                    <p className="text-sm text-[#f57f17] font-semibold">
                      Health Score: {d.health_score}/100
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      sentiment: {Number(d.sentiment).toFixed(2)} | intention:{" "}
                      {Number(d.intention).toFixed(2)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />

          <Scatter data={data.data} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(EMOTION_EMOJI).map(([emotion, emoji]) => (
          <div key={emotion} className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <span className="text-sm text-gray-300 capitalize">{emotion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
