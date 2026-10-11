import React, { useState, useMemo } from "react";
import { MASTER_LIST_MODELS } from "../modelsData";
import { parseModelRawString, searchReferenceModels } from "../utils/modelParser";
import { Sparkles, ArrowRight } from "lucide-react";

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelAdded: (category: string, modelName: string, customModels?: any[], evaluations?: any) => void;
  existingModelsByCat?: Record<string, string[]>;
}

const CATEGORIES = [
  { id: "Portables Lenovo", name: "Portables Lenovo (ThinkPad)", icon: "💻", brand: "Lenovo" },
  { id: "Portables Dell", name: "Portables Dell (Latitude, Precision)", icon: "💻", brand: "Dell" },
  { id: "Portables Dell XPS", name: "Portables Dell XPS (Série Haute Performance)", icon: "🚀", brand: "Dell" },
  { id: "Portables HP", name: "Portables HP (EliteBook, ProBook)", icon: "💻", brand: "HP" },
  { id: "Apple", name: "Portables Apple (MacBook Air / Pro)", icon: "🍏", brand: "Apple" },
  { id: "Desktop Lenovo", name: "Tours de Bureau Lenovo (ThinkCentre)", icon: "🖥️", brand: "Lenovo" },
  { id: "Desktop Dell", name: "Tours de Bureau Dell (OptiPlex)", icon: "🖥️", brand: "Dell" },
  { id: "Desktop HP", name: "Tours de Bureau HP (EliteDesk, ProDesk)", icon: "🖥️", brand: "HP" },
  { id: "iPhones", name: "Téléphones Apple iPhone", icon: "📱", brand: "Apple" }
];

// Alias connus pour assistance en direct
const KNOWN_CHASSIS_CODES: Record<string, string> = {
  "p129f001": "Dell XPS 15 9500",
  "p129f": "Dell XPS 15 9500",
  "p117g": "Dell XPS 13 9300",
  "p117g001": "Dell XPS 13 9300",
  "p92f": "Dell XPS 17 9700",
  "p92f001": "Dell XPS 17 9720"
};

const POPULAR_SUGGESTIONS: Record<string, string[]> = {
  "Portables Lenovo": ["ThinkPad T14 Gen 3", "ThinkPad T14 Gen 4", "ThinkPad L14 Gen 3", "ThinkPad X1 Carbon Gen 10", "ThinkPad E14 Gen 4", "ThinkPad P14s Gen 2"],
  "Portables Dell": ["Latitude 5430", "Latitude 5440", "Latitude 7430", "Latitude 7440", "Precision 3570", "Latitude 5530"],
  "Portables Dell XPS": ["Dell XPS 13 9315", "Dell XPS 13 Plus 9320", "Dell XPS 15 9530", "Dell XPS 17 9730"],
  "Portables HP": ["EliteBook 840 G9", "EliteBook 840 G10", "ProBook 450 G9", "ProBook 440 G9", "ZBook Firefly 14 G9"],
  "Apple": ["MacBook Air M1", "MacBook Air M2", "MacBook Air M3", "MacBook Pro M2 14\"", "MacBook Pro M3 16\""],
  "Desktop Lenovo": ["ThinkCentre M70q Gen 3", "ThinkCentre M80s Gen 3", "ThinkCentre M90a Gen 3", "ThinkCentre M720q"],
  "Desktop Dell": ["OptiPlex 7000 Micro", "OptiPlex 5000 SFF", "Precision 3660 Tower", "OptiPlex 3080 Micro"],
  "Desktop HP": ["EliteDesk 800 G8 Mini", "ProDesk 400 G8 SFF", "Z2 Mini G9"],
  "iPhones": ["iPhone 13 Pro", "iPhone 14", "iPhone 14 Pro", "iPhone 15", "iPhone 15 Pro"]
};

const SPEC_TAGS = {
  ram: ["8 Go RAM", "16 Go RAM", "32 Go RAM", "64 Go RAM"],
  storage: ["256 Go SSD", "512 Go SSD", "1 To SSD", "2 To SSD"],
  cpu: ["Core i5", "Core i7", "Core i9", "Ryzen 5 Pro", "Ryzen 7 Pro", "Apple M2 / M3"]
};

export default function AddModelModal({ isOpen, onClose, onModelAdded, existingModelsByCat }: AddModelModalProps) {
  const [selectedCategory, setSelectedCategory] = useState("Portables Lenovo");
  const [modelInput, setModelInput] = useState("");
  const [chassisInput, setChassisInput] = useState("");
  const [specsInput, setSpecsInput] = useState("16 Go RAM, 512 Go SSD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Détection intelligente à la volée (Smart Parser pour chaînes d'atelier / inventaire brut)
  const smartParsed = useMemo(() => {
    if (!modelInput || modelInput.trim().length < 3) return null;
    return parseModelRawString(modelInput);
  }, [modelInput]);

  // Autocomplétion dynamique depuis le dictionnaire de référence (~350 modèles)
  const autocompleteSuggestions = useMemo(() => {
    if (!modelInput || modelInput.trim().length < 2) return [];
    return searchReferenceModels(modelInput, 5);
  }, [modelInput]);

  // Normalisation intelligente et détection du format commercial
  const cleanAndFormattedModel = useMemo(() => {
    let raw = (modelInput || "").trim();
    if (!raw) return "";

    // Si l'utilisateur a tapé directement un code constructeur (ex: P129F001)
    const lower = raw.toLowerCase();
    if (KNOWN_CHASSIS_CODES[lower]) {
      return KNOWN_CHASSIS_CODES[lower];
    }

    const parsed = parseModelRawString(raw);
    const candidate = parsed.cleanModelName || raw;

    // Auto-majuscules standards pour éviter les erreurs de frappe et variations inutiles
    return candidate
      .replace(/\bthinkpad\b/i, "ThinkPad")
      .replace(/\blatitude\b/i, "Latitude")
      .replace(/\boptiplex\b/i, "OptiPlex")
      .replace(/\belitebook\b/i, "EliteBook")
      .replace(/\bprobook\b/i, "ProBook")
      .replace(/\bthinkcentre\b/i, "ThinkCentre")
      .replace(/\bmacbook\b/i, "MacBook")
      .replace(/\bxps\b/i, "XPS")
      .replace(/\bgen\b/i, "Gen");
  }, [modelInput]);

  // Vérifier si le modèle existe déjà dans n'importe quelle catégorie (Master + Custom)
  const duplicateCheck = useMemo(() => {
    if (!cleanAndFormattedModel) return null;
    const target = cleanAndFormattedModel.toLowerCase();

    // Check in MASTER_LIST_MODELS
    for (const catObj of MASTER_LIST_MODELS) {
      if (!catObj || !Array.isArray(catObj.models)) continue;
      const found = catObj.models.find(m => m && typeof m === "string" && m.toLowerCase() === target);
      if (found) {
        return { category: catObj.categoryName, exactName: found };
      }
    }

    // Check in existingModelsByCat if provided
    if (existingModelsByCat && typeof existingModelsByCat === "object") {
      for (const [cat, list] of Object.entries(existingModelsByCat)) {
        if (Array.isArray(list)) {
          const found = list.find(m => m && typeof m === "string" && m.toLowerCase() === target);
          if (found) {
            return { category: cat, exactName: found };
          }
        }
      }
    }

    return null;
  }, [cleanAndFormattedModel, existingModelsByCat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cleanAndFormattedModel) {
      setErrorMsg("Veuillez saisir ou sélectionner un nom de modèle valide.");
      return;
    }

    if (duplicateCheck) {
      setErrorMsg(`Ce modèle existe déjà dans la catégorie "${duplicateCheck.category}" sous le nom "${duplicateCheck.exactName}". Vous ne pouvez pas créer de doublons.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch("/api/models/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          modelName: cleanAndFormattedModel,
          chassisCode: chassisInput.trim(),
          configuration: specsInput.trim()
        })
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("API error response:", resp.status, text);
        setErrorMsg(`Le serveur a répondu avec une erreur (${resp.status}). Veuillez vérifier que le backend tourne sur le port 3000 ou redémarrez 'npm run dev'.`);
        setIsSubmitting(false);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setErrorMsg("La réponse du serveur n'est pas au format JSON. Vérifiez que le serveur Express tourne bien via 'npm run dev' et non 'vite' seul.");
        setIsSubmitting(false);
        return;
      }

      const data = await resp.json();
      if (!data.success) {
        setErrorMsg(data.message || "Erreur lors de l'ajout du modèle.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onModelAdded(selectedCategory, cleanAndFormattedModel, data.customModels, data.evaluations);
      onClose();
      setModelInput("");
      setChassisInput("");
    } catch (err: any) {
      console.error("Add model network error:", err);
      setIsSubmitting(false);
      setErrorMsg("Erreur de communication avec le serveur local. Veuillez vous assurer que le serveur Express ('npm run dev') est actif.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-brand-purple text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-base font-bold font-title tracking-wide uppercase">Ajouter un nouveau modèle</h2>
              <p className="text-[11px] text-brand-lime font-mono">Assistant par étiquettes & anti-erreur</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-slate-800 dark:text-slate-200 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-700 dark:text-rose-300">
              <span className="text-base">⚠️</span>
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* 1. Catégorie */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              1. Sélectionner la gamme / catégorie de l'équipement
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-brand-purple dark:focus:ring-brand-lime outline-none transition-all cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Nom du modèle ou Choix par étiquettes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              2. Nom commercial du modèle (sélectionnez une étiquette ou saisissez)
            </label>
            <input
              type="text"
              required
              placeholder="Ex: ThinkPad T14 Gen 3 ou collez une ligne d'inventaire (ex: Dell 5420 i7 16GB 512SSD)"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:ring-2 focus:ring-brand-purple dark:focus:ring-brand-lime outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />

            {/* Suggestions du dictionnaire de référence (~350 modèles populaires) */}
            {autocompleteSuggestions.length > 0 && (
              <div className="mt-2" id="reference-autocomplete-list">
                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center space-x-1">
                  <span>💡 Modèles du marché correspondants :</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {autocompleteSuggestions.map((ref) => (
                    <button
                      key={ref.name}
                      type="button"
                      onClick={() => {
                        setModelInput(ref.name);
                        setSelectedCategory(ref.category);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer flex items-center space-x-1"
                      title={`Sélectionner ${ref.name} (${ref.category})`}
                    >
                      <span>+ {ref.name}</span>
                      <span className="text-[9px] text-slate-400">({ref.category})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Détection intelligente d'inventaire brut (Smart Parser) */}
            {smartParsed && (smartParsed.specs.fullConfiguration || (smartParsed.detectedBrand && smartParsed.cleanModelName !== modelInput.trim())) && (
              <div className="mt-2.5 p-3 rounded-lg border border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 text-xs animate-fadeIn" id="smart-parsed-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-brand-purple dark:text-brand-lime flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Détection automatique d'inventaire</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setModelInput(smartParsed.cleanModelName);
                      setSelectedCategory(smartParsed.category);
                      if (smartParsed.specs.fullConfiguration) {
                        setSpecsInput(smartParsed.specs.fullConfiguration);
                      }
                    }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold bg-brand-purple hover:bg-[#3d0877] dark:bg-brand-lime dark:hover:opacity-90 text-white dark:text-slate-900 transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span>Appliquer tout</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-0.5">
                  <div>Modèle isolé : <strong className="text-slate-900 dark:text-white">{smartParsed.cleanModelName}</strong></div>
                  <div>Catégorie : <strong className="text-brand-purple dark:text-brand-lime">{smartParsed.category}</strong></div>
                  {smartParsed.specs.fullConfiguration && (
                    <div className="text-slate-500 dark:text-slate-400">
                      Configuration : <span className="font-semibold text-slate-700 dark:text-slate-300">{smartParsed.specs.fullConfiguration}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suggestions rapides en étiquettes */}
            <div className="mt-2.5">
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center space-x-1">
                <span>🏷️ Choix par étiquettes en 1 clic (évite les fautes manuscrites) :</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(POPULAR_SUGGESTIONS[selectedCategory] || []).map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setModelInput(sug)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center space-x-1 ${
                      cleanAndFormattedModel.toLowerCase() === sug.toLowerCase()
                        ? "bg-brand-purple text-white border-brand-purple shadow-sm dark:bg-brand-lime dark:text-slate-900 font-bold"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>+ {sug}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview & Duplicate Warning */}
            {cleanAndFormattedModel && (
              <div className="mt-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Nom normalisé final :</span>
                  <span className="font-bold text-brand-purple dark:text-brand-lime">{cleanAndFormattedModel}</span>
                </div>
                {duplicateCheck && (
                  <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-900 text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center space-x-1.5">
                    <span>🛑</span>
                    <span>Modèle déjà présent dans la catégorie "{duplicateCheck.category}".</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Code châssis alternatif (Optionnel) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              3. Code châssis constructeur (Optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: P129F001, 20W0, 82BG"
              value={chassisInput}
              onChange={(e) => setChassisInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-brand-purple outline-none"
            />
          </div>

          {/* 4. Configuration par étiquettes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              4. Configuration d'atelier (Cliquez les étiquettes ou modifiez)
            </label>
            <input
              type="text"
              placeholder="Ex: Core i5, 16 Go RAM, 512 Go SSD"
              value={specsInput}
              onChange={(e) => setSpecsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-brand-purple outline-none"
            />

            {/* Étiquettes de configuration rapides */}
            <div className="mt-2 space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                🏷️ Composer par étiquettes (en 1 clic) :
              </span>
              <div className="flex flex-wrap gap-1">
                {SPEC_TAGS.ram.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const parts = specsInput.split(",").map(p => p.trim()).filter(p => p && !p.toLowerCase().includes("ram"));
                      parts.push(t);
                      setSpecsInput(parts.join(", "));
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors cursor-pointer"
                  >
                    💾 {t}
                  </button>
                ))}
                {SPEC_TAGS.storage.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const parts = specsInput.split(",").map(p => p.trim()).filter(p => p && !p.toLowerCase().includes("ssd") && !p.toLowerCase().includes("hdd") && !p.toLowerCase().includes("go"));
                      parts.push(t);
                      setSpecsInput(parts.join(", "));
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                  >
                    💽 {t}
                  </button>
                ))}
                {SPEC_TAGS.cpu.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const parts = specsInput.split(",").map(p => p.trim()).filter(p => p && !p.toLowerCase().includes("core") && !p.toLowerCase().includes("ryzen") && !p.toLowerCase().includes("intel") && !p.toLowerCase().includes("apple"));
                      parts.unshift(t);
                      setSpecsInput(parts.join(", "));
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                  >
                    ⚡ {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!duplicateCheck || !cleanAndFormattedModel}
              className={`px-5 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-md flex items-center space-x-2 ${
                isSubmitting || !!duplicateCheck || !cleanAndFormattedModel
                  ? "bg-slate-400 cursor-not-allowed opacity-60"
                  : "bg-brand-purple hover:bg-[#3d0877] shadow-[0_4px_12px_rgba(72,10,148,0.3)] cursor-pointer"
              }`}
            >
              <span>{isSubmitting ? "Enregistrement..." : "✨ Enregistrer et surveiller"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
