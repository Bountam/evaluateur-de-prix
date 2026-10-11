import React, { useState, useRef, useEffect, useCallback } from "react";
import { HelpCircle, X, Info } from "lucide-react";
import { HelpTopic } from "../../constants/helpContent";

interface HelpTooltipProps {
  topic?: HelpTopic;
  title?: string;
  description?: string;
  tips?: string;
  side?: "top" | "bottom" | "left" | "right";
  size?: "xs" | "sm" | "md";
  className?: string;
  id?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  topic,
  title: propTitle,
  description: propDesc,
  tips: propTips,
  side = "bottom",
  size = "sm",
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const title = topic?.title || propTitle || "Information";
  const description = topic?.description || propDesc || "";
  const tips = topic?.tips || propTips;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
  }, []);

  // Fermeture automatique lors d'un clic en dehors
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
  }[size];

  // Classes de positionnement de la bulle
  const positionClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  }[side];

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      id={id ? `help-container-${id}` : undefined}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label={`Aide : ${title}`}
        className="p-0.5 rounded-full text-slate-400 hover:text-brand-purple dark:text-slate-400 dark:hover:text-brand-lime transition-colors focus:outline-none focus:ring-1 focus:ring-brand-purple cursor-pointer inline-flex items-center justify-center"
        id={id ? `help-btn-${id}` : undefined}
      >
        <HelpCircle className={`${sizeClasses} shrink-0`} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${positionClasses} z-50 w-72 sm:w-80 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl text-left text-slate-800 dark:text-slate-100 animate-fadeIn font-sans text-xs select-text cursor-default`}
          style={{ minWidth: "260px" }}
          id={id ? `help-popover-${id}` : undefined}
        >
          {/* En-tête de la bulle */}
          <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white text-[12px] leading-tight">
              <Info className="w-3.5 h-3.5 text-brand-purple dark:text-brand-lime shrink-0" />
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
              aria-label="Fermer la bulle d'aide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description principale */}
          <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </div>

          {/* Conseil pratique / Astuce (si présent) */}
          {tips && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-brand-purple dark:text-brand-lime bg-brand-purple/5 dark:bg-brand-lime/10 p-2 rounded">
              <span className="font-bold">💡 Astuce : </span>
              <span>{tips}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;
