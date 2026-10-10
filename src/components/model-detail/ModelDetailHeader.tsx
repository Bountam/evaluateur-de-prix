import React from "react";

interface ModelDetailHeaderProps {
  modelName: string;
  category: string;
}

export const ModelDetailHeader: React.FC<ModelDetailHeaderProps> = ({
  modelName,
  category,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4" id="model-header-row">
      <div>
        <span className="text-[10px] font-bold text-brand-purple dark:text-brand-lime uppercase tracking-wider font-mono">
          {category}
        </span>
        <h1 className="text-3xl font-serif italic text-[#2D3436] tracking-tight mt-0.5">
          {modelName}
        </h1>
        <p className="text-xs text-[#7F8C8D] mt-1">
          Analyse comparative et calcul empirique de la valeur médiane d'approvisionnement.
        </p>
      </div>
    </div>
  );
};
