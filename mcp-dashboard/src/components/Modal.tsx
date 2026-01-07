import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full",
            maxWidthClass,
            "rounded-[28px] border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl",
          ].join(" ")}
        >
          {/* header */}
          <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <h3 className="text-lg font-bold text-white truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>

            <button
              onClick={onClose}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          {/* content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
