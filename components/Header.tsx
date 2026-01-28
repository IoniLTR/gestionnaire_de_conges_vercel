"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// --- TYPE UTILISATEUR ---
interface User {
  id_user: number;
  prenom: string;
  nom: string;
  poste: string;
  photo?: string;
}

interface NavLink {
  label: string;
  href: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Récupérer l'utilisateur courant ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/profil");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (err) {
        console.error(err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    if (pathname !== "/" && pathname !== "/forgot-password") fetchUser();
    else setLoading(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // --- Pas de header sur certaines pages ---
  if (pathname === "/" || pathname === "/forgot-password") return null;

  const isAdmin = user?.poste?.toLowerCase() === "admin" || user?.poste?.toLowerCase() === "rh";

  // --- Liens dynamiques selon rôle ---
  const links: NavLink[] = isAdmin
    ? [
        { label: "Dashboard", href: "/dashboard-admin" },
        { label: "Utilisateurs", href: "/user-setting" },
        { label: "Demander", href: "/demandes" },
        { label: "Profil", href: "/profil" },
      ]
    : [
        { label: "Dashboard", href: "/dashboard-user" },
        { label: "Demander", href: "/demandes" },
        { label: "Profil", href: "/profil" },
      ];

  return (
    <nav className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 font-[poppins] border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          
          {/* PROFIL */}
          <div className="flex items-center">
            <Link href="/profil" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-[#ff6400] rounded-full blur opacity-0 group-hover:opacity-30 transition duration-500 transform group-hover:scale-110"></div>
                {user?.photo ? (
                  <img
                    src={user.photo}
                    alt="Profil"
                    className="relative w-11 h-11 rounded-full object-cover border-2 border-[#000091] bg-white"
                  />
                ) : (
                  <div className="relative w-11 h-11 bg-[#000091] rounded-full flex items-center justify-center text-white font-[Modak] text-xl border-2 border-[#000091]">
                    {user?.prenom?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-[Modak] text-[#000091] text-xl leading-none group-hover:text-[#ff6400] transition-colors duration-300">
                  {user?.prenom} {user?.nom}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest group-hover:text-gray-600 transition-colors">
                  {user?.poste || "-"}
                </span>
              </div>
            </Link>
          </div>

          {/* MENU DESKTOP */}
          <div className="hidden md:flex items-center space-x-1 bg-gray-50/80 p-1.5 rounded-full border border-gray-100">
            {!loading &&
              links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-[#000091] text-white shadow-lg shadow-blue-200 transform scale-105"
                        : "text-gray-500 hover:text-[#000091] hover:bg-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
          </div>
          
          {/* BOUTON DÉCONNEXION DESKTOP */}
          <button
            onClick={handleLogout}
            className="hidden md:block px-6 py-2.5 bg-white border-2 border-[#ff6400] text-[#ff6400] rounded-full text-sm font-bold hover:bg-[#ff6400] hover:text-white transition duration-300 shadow-sm hover:shadow-orange-200"
          >
            Sortir
          </button>

          {/* BOUTON MOBILE */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-[#000091] p-2 hover:bg-gray-50 rounded-xl transition"
            >
              <span className="text-3xl">☰</span>
            </button>
          </div>
        </div>
      </div>

      {/* MENU MOBILE */}
      {isOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 absolute w-full left-0 shadow-2xl rounded-b-[2rem] overflow-hidden transition-all animate-fadeIn">
          <div className="px-6 py-6 space-y-3">
            {!loading &&
              links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 rounded-2xl text-lg font-[Modak] tracking-wide transition-all ${
                    pathname === link.href ? "bg-[#e6e6ff] text-[#000091] pl-6" : "text-gray-600 hover:text-[#000091] hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            <div className="border-t border-gray-100 my-2 pt-4">
              <button
                onClick={handleLogout}
                className="w-full text-left block px-4 py-3 rounded-2xl text-lg font-[Modak] text-[#ff6400] hover:bg-orange-50 transition-colors"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
