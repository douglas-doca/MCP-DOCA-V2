import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface LoadingStep {
  id: string;
  label: string;
  status: "pending" | "loading" | "done" | "error";
}

interface Props {
  tenantName: string;
  tenantSlug?: string;
  steps: LoadingStep[];
  progress: number;
}

export default function TenantLoader({ tenantName, tenantSlug, steps, progress }: Props) {
  const logoUrl = tenantSlug ? `/logos/${tenantSlug}.png` : null;
  const initial = tenantName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="h-24 w-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="h-16 w-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = document.getElementById("tenant-logo-fallback");
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div 
                id="tenant-logo-fallback"
                className={`h-16 w-16 rounded-xl bg-gradient-to-br from-[#f57f17] to-[#ff9800] items-center justify-center ${logoUrl ? "hidden" : "flex"}`}
              >
                <span className="text-3xl font-bold text-white">{initial}</span>
              </div>
            </div>
            
            {/* Progress ring */}
            <svg className="absolute -inset-2 w-28 h-28" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="46"
                fill="none"
                stroke="url(#loaderGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.89} 289`}
                transform="rotate(-90 50 50)"
                className="transition-all duration-300"
              />
              <defs>
                <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f57f17" />
                  <stop offset="100%" stopColor="#ff9800" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Name */}
        <h2 className="text-2xl font-bold text-white text-center mb-1">{tenantName}</h2>
        <p className="text-gray-500 text-sm text-center mb-8">Preparando ambiente...</p>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map(step => (
            <div key={step.id} className={`flex items-center gap-3 transition-opacity ${step.status === "pending" ? "opacity-40" : "opacity-100"}`}>
              {step.status === "pending" && <Circle className="w-5 h-5 text-gray-600" />}
              {step.status === "loading" && <Loader2 className="w-5 h-5 text-[#f57f17] animate-spin" />}
              {step.status === "done" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {step.status === "error" && <Circle className="w-5 h-5 text-red-400" />}
              <span className={`text-sm ${
                step.status === "done" ? "text-gray-400" :
                step.status === "loading" ? "text-white font-medium" :
                step.status === "error" ? "text-red-400" : "text-gray-600"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#f57f17] to-[#ff9800] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">{progress}%</p>
      </div>
    </div>
  );
}