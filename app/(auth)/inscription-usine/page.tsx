"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InscriptionUsinePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [poste, setPoste] = useState<"admin" | "RH">("admin");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/bootstrap-status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setAllowed(Boolean(data && data.hasAnyUser === false));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const requestToken = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/request-signup-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "factory" }),
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
        body: JSON.stringify({ email, token, password, mode: "factory", nom, prenom, poste }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Impossible d'initialiser.");
        setLoading(false);
        return;
      }
      setMsg("Initialisation OK ✅ Vous pouvez vous connecter.");
      setTimeout(() => router.push("/"), 600);
    } catch {
      setErr("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</div>;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fc] p-4">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,145,0.1)] p-8 border border-gray-100 text-center">
          <h1 className="text-3xl font-[Modak] text-[#000091] mb-2">Initialisation déjà faite</h1>
          <p className="text-gray-500 mb-6">
            Un compte existe déjà. Le formulaire d'usine est désactivé.
          </p>
          <Link className="text-gray-400 hover:text-[#ff6400] font-bold" href="/">
            ← Retour connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fc] p-4 relative overflow-hidden font-[poppins]">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#000091] rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-[#ff6400] rounded-full opacity-10 blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,145,0.1)] p-8 sm:p-10 relative z-10 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-[Modak] text-[#000091] tracking-wide">Inscription d'usine</h1>
          <p className="text-gray-400 font-medium mt-2">À utiliser uniquement pour le tout premier admin/RH (une seule fois).</p>
        </div>

        {err && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 mb-4">{err}</div>}
        {msg && <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-sm font-bold border border-green-100 mb-4">{msg}</div>}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Prénom</label>
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Nom</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium"
                />
              </div>
            </div>

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

            <div>
              <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Rôle</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPoste("admin")}
                  className={`flex-1 py-3 rounded-2xl font-bold border transition ${
                    poste === "admin" ? "bg-[#000091] text-white border-[#000091]" : "bg-white text-[#000091] border-gray-200"
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setPoste("RH")}
                  className={`flex-1 py-3 rounded-2xl font-bold border transition ${
                    poste === "RH" ? "bg-[#000091] text-white border-[#000091]" : "bg-white text-[#000091] border-gray-200"
                  }`}
                >
                  RH
                </button>
              </div>
            </div>

            <button
              onClick={requestToken}
              disabled={loading || !email || !nom || !prenom}
              className="w-full bg-[#000091] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? "Envoi..." : "Recevoir le code d'initialisation"}
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
              <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Mot de passe</label>
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
              {loading ? "Validation..." : "Créer le compte admin/RH"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                className="text-gray-400 hover:text-[#ff6400] font-bold"
                onClick={() => setStep(1)}
                type="button"
              >
                ← Retour
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
