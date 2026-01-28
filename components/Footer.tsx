"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // On cache le footer sur la page de login et mot de passe oublié
  if (pathname === "/" || pathname === "/forgot-password") return null;

  return (
    <footer className="bg-white/80 backdrop-blur-xl border-t border-gray-100 py-8 mt-auto font-[poppins]">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-center items-center gap-2 text-sm text-gray-400 font-medium">
        
        <span className="flex items-center gap-2">
          BY
        </span>

        <div className="flex items-center gap-1">
            <a 
            href="https://www.linkedin.com/in/ioni-letellier/" 
            target="_blank"  
            className="font-[Modak] text-xl text-[#000091] hover:scale-102 transition-transform duration-300 relative group ml-1">
            Ioni Letellier
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#ff6400] group-hover:w-full transition-all duration-300"></span>
          </a>
          <span>&</span>
        <a 
            href="https://www.linkedin.com/in/heinz-hartmaier-9b911326b/" 
            target="_blank"  
            className="font-[Modak] text-xl text-[#000091] hover:scale-102 transition-transform duration-300 relative group ml-1">
            Heinz Hartmaier
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#ff6400] group-hover:w-full transition-all duration-300"></span>
          </a>
        </div>

        <span className="flex items-center gap-1">
          pour 
          <a 
            href="https://ze-com.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-[Modak] text-xl text-[#000091] hover:scale-102 transition-transform duration-300 relative group ml-1"
          >
            Ze-Com
            {/* Petit soulignement animé */}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#ff6400] group-hover:w-full transition-all duration-300"></span>
          </a>
        </span>

      </div>
    </footer>
  );
}