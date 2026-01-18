// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LoginPage from "./pages/LoginPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Loader2 } from "lucide-react";
import "./index.css";

function AuthenticatedApp() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-[#f57f17] animate-spin" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  </React.StrictMode>
);