import { useState } from "react";
import { Loader2, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (!email || !password) {
      setLocalError("Preencha todos os campos");
      return;
    }

    try {
      await signIn(email, password);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao fazer login");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#f57f17] to-[#ff9800] mb-4 shadow-lg shadow-[#f57f17]/20">
            <span className="text-3xl font-bold text-white">D</span>
          </div>
          <h1 className="text-3xl font-bold text-white">MCP Dashboard</h1>
          <p className="text-gray-500 mt-2">Entre para continuar</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || localError) && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error || localError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-[#f57f17]/50 transition"
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-[#f57f17]/50 transition"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#f57f17] to-[#ff9800] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition hover:shadow-lg hover:shadow-[#f57f17]/20"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-sm mt-8">
          DOCA Agência IA © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
