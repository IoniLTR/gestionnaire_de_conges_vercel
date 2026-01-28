'use client';

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la demande");
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fc] p-4 relative overflow-hidden font-[poppins]">
      {/* Décors Ze-Com */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#000091] rounded-full opacity-10 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 -right-20 w-[25rem] h-[25rem] bg-[#ff6400] rounded-full opacity-10 blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,145,0.1)] p-10 relative z-10 border border-gray-100">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-[Modak] text-[#000091] mb-2">Mot de passe oublié ?</h1>
            <p className="text-gray-400 font-medium text-sm">Pas de panique, on va régler ça.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-center text-sm font-bold border border-red-100 animate-bounce">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-4 rounded-2xl text-center text-sm font-bold border border-green-100">
              {message}
            </div>
          )}

          <div className="group">
            <label className="block text-xs font-bold text-[#000091] uppercase mb-2 ml-1 tracking-wider">Votre Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              required
              className="w-full bg-[#f8f9fc] border-2 border-transparent focus:border-[#000091] rounded-2xl px-5 py-4 text-gray-700 outline-none transition-all duration-300 font-medium placeholder-gray-300 hover:bg-white hover:border-gray-200 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#000091] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-[#ff6400] hover:shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            {loading ? "Envoi en cours..." : "Envoyer le lien"}
          </button>

          <div className="text-center mt-6">
            <Link href="/" className="text-sm font-bold text-gray-400 hover:text-[#000091] transition underline decoration-transparent hover:decoration-[#000091]">
              ← Retour à la connexion
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}