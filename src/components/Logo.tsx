import React, { useState } from "react";

export interface LogoProps {
  className?: string;
  logoUrl?: string | null;
  orgName?: string | null;
}

export default function Logo({ className = "h-8", logoUrl, orgName }: LogoProps) {
  const [imageError, setImageError] = useState(false);

  // 1. Si une URL de logo personnalisée est configurée et valide
  if (logoUrl && !imageError) {
    return (
      <img
        src={logoUrl}
        alt={orgName ? `Logo ${orgName}` : "Logo Organisation"}
        className={`${className} max-w-[200px] object-contain shrink-0 rounded-sm`}
        onError={() => setImageError(true)}
      />
    );
  }

  // 2. Logo vectoriel générique flat icon : Ordinateur portable & Scintillants dorés
  return (
    <svg
      version="1.1"
      id="app-generic-logo"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`${className} shrink-0 aspect-square`}
      role="img"
      aria-label={orgName ? `Évaluateur de Prix - ${orgName}` : "Évaluateur de Prix du Marché Reconditionné"}
    >
      {/* Écran de l'ordinateur portable */}
      <rect x="18" y="24" width="64" height="42" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
      <rect x="23" y="29" width="54" height="32" rx="2" fill="#0284C7" />
      
      {/* Courbe d'évaluation du marché sur l'écran */}
      <path
        d="M28 51 L39 43 L48 47 L59 36 L71 40"
        stroke="#E0F2FE"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="59" cy="36" r="2" fill="#F59E0B" />
      <circle cx="71" cy="40" r="2" fill="#10B981" />

      {/* Base du clavier et encoche */}
      <path d="M12 68 L88 68 L83 77 L17 77 Z" fill="#334155" />
      <rect x="44" y="68" width="12" height="2.5" rx="1" fill="#94A3B8" />

      {/* Scintillants dorés (Golden Sparkles) */}
      {/* Scintillant principal */}
      <path
        d="M78 9 Q78 19 88 19 Q78 19 78 29 Q78 19 68 19 Q78 19 78 9 Z"
        fill="#F59E0B"
      />
      {/* Scintillant secondaire */}
      <path
        d="M66 6 Q66 11 71 11 Q66 11 66 16 Q66 11 61 11 Q66 11 66 6 Z"
        fill="#FBBF24"
      />
      {/* Scintillant tertiaire */}
      <path
        d="M89 27 Q89 31 93 31 Q89 31 89 35 Q89 31 85 31 Q89 31 89 27 Z"
        fill="#FDE68A"
      />
    </svg>
  );
}
