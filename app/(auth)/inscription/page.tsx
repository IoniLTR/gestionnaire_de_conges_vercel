"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InscriptionPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const requestToken = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/request-signup-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "invited" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Impossible d'envoyer le code.");
        setLoading(false);
        return;
      }
      setMsg("Code envoyé (valable 10 minutes).");
      setStep(2);
    } catch {
      setErr("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password, mode: "invited" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Impossible de finaliser l'inscription.");
        setLoading(false);
        return;
      }
      setMsg("Compte activé ✅ Vous pouvez vous connecter.");
      setTimeout(() => router.push("/"), 600);
    } catch {
      setErr("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fc] p-4 relative overflow-hidden font-[poppins]">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#000091] rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-[#ff6400] rounded-full opacity-10 blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,145,0.1)] p-8 sm:p-10 relative z-10 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-[Modak] text-[#000091] tracking-wide">Activer mon compte</h1>
          <p className="text-gray-400 font-medium mt-2">Disponible uniquement si votre compte a été pré-créé par l'admin.</p>
        </div>

        {err && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 mb-4">{err}</div>}
        {msg && <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-sm font-bold border border-green-100 mb-4">{msg}</div>}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@ze-com.com"
                required
                className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium placeholder-gray-300"
              />
            </div>

            <button
              onClick={requestToken}
              disabled={loading || !email}
              className="w-full bg-[#000091] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? "Envoi..." : "Recevoir mon code"}
            </button>

            <div className="text-center text-sm">
              <Link className="text-gray-400 hover:text-[#ff6400] font-bold" href="/">
                ← Retour connexion
              </Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Code (6 chiffres)</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#ff6400] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium"
              />
              <p className="text-xs text-gray-400 mt-2">6 caractères minimum.</p>
            </div>

            <button
              onClick={complete}
              disabled={loading || !email || !token || password.length < 6}
              className="w-full bg-[#000091] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? "Validation..." : "Activer mon compte"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                className="text-gray-400 hover:text-[#ff6400] font-bold"
                onClick={() => setStep(1)}
                type="button"
              >
                ← Changer d'email
              </button>
              <Link className="text-gray-400 hover:text-[#ff6400] font-bold" href="/">
                Connexion
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
