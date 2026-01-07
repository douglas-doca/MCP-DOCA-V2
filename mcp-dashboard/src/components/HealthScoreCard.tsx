import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: "blue" | "green" | "orange" | "red";
};

const ACCENT: Record<string, string> = {
  blue: "border-cyan-500/40",
  green: "border-green-500/40",
  orange: "border-orange-500/40",
  red: "border-red-500/40",
};

const ACCENT_BG: Record<string, string> = {
  blue: "from-cyan-500/15 to-cyan-500/5",
  green: "from-green-500/15 to-green-500/5",
  orange: "from-orange-500/15 to-orange-500/5",
  red: "from-red-500/15 to-red-500/5",
};

export function HealthScoreCard({
  title,
  value,
  subtitle,
  icon,
  trend = "neutral",
  accent = "blue",
}: Props) {
  return (
    <div
      className={`bg-white/5 border ${ACCENT[accent]} rounded-2xl p-5 backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-white">{value}</p>

            {trend !== "neutral" && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  trend === "up" ? "text-green-400" : "text-red-400"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </span>
            )}
          </div>

          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>

        <div
          className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${ACCENT_BG[accent]} border border-white/10 flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
