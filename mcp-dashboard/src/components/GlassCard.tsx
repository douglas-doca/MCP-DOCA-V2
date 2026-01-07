import React from "react";

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function GlassCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: GlassCardProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-white/10",
        "bg-gradient-to-b from-white/[0.07] to-white/[0.03]",
        "backdrop-blur-xl",
        "shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
        "hover:border-white/20 transition-colors",
        className,
      ].join(" ")}
    >
      {(title || subtitle || right) && (
        <div className="px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <h3 className="text-white font-semibold text-base leading-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-slate-400 text-sm mt-1 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>

            {right && <div className="shrink-0">{right}</div>}
          </div>
        </div>
      )}

      <div className="px-6 pb-6 pt-5">{children}</div>
    </div>
  );
}
