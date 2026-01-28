'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur de connexion");
        setLoading(false);
        return;
      }

      const poste = data.user.poste.toLowerCase();
      router.push(poste === "admin" || poste === "rh" ? "/dashboard-admin" : "/dashboard-user");
    } catch (err) {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fc] p-4 relative overflow-hidden font-[poppins]">
      {/* Décors Ze-Com Style */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#000091] rounded-full opacity-10 blur-3xl animate-pulse"></div>
      <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-[#ff6400] rounded-full opacity-10 blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,145,0.1)] p-10 relative z-10 border border-gray-100">
        <div className="text-center mb-10">
            {/* LOGO MODIFIÉ : Image au lieu du texte 'Z' */}
            <div className="w-20 h-20 bg-[#000091] rounded-3xl rotate-3 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 overflow-hidden">
                <img 
                  src="/uploads/default.jpeg" 
                  alt="Logo Ze-Congés" 
                  className="w-full h-full object-cover" 
                />
            </div>
            {/* TITRE MODIFIÉ : Ze-Congés */}
            <h1 className="text-5xl font-[Modak] text-[#000091] tracking-wide mb-2">Ze-Congés</h1>
            <p className="text-gray-400 font-medium">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-center text-sm font-bold border border-red-100 animate-bounce">
              {error}
            </div>
          )}

          <div className="group">
            <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium placeholder-gray-300 hover:bg-white hover:border-gray-200 focus:bg-white"
            />
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#ff6400] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium placeholder-gray-300 hover:bg-white hover:border-gray-200 focus:bg-white"
            />
            <div className="mt-3 text-right">
              <Link href="/forgot-password" className="text-xs font-bold text-gray-400 hover:text-[#ff6400] transition">
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-center">
            <Link href="/inscription" className="text-xs font-bold text-gray-400 hover:text-[#000091] transition">
              Activer mon compte
            </Link>
            <Link href="/inscription-usine" className="text-xs font-bold text-gray-400 hover:text-[#ff6400] transition">
              Inscription d&apos;usine (1ère fois)
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#000091] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            {loading ? "Chargement..." : "Se connecter"}
          </button>
        </form>
      </div>
      
      <div className="absolute bottom-4 text-center w-full text-xs text-gray-300 font-bold">
         © {new Date().getFullYear()} ZE-COM AGENCY
      </div>
    </div>
  );
}