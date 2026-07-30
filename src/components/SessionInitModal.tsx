import React, { useState, useRef } from "react";
import { User, FileSpreadsheet, Upload, Check, AlertCircle, ArrowRight, Shield } from "lucide-react";

interface SessionInitModalProps {
  isOpen: boolean;
  onStartSession: (userName: string, fileData?: string) => Promise<void>;
  hasExistingMasterFile: boolean;
}

export default function SessionInitModal({ isOpen, onStartSession, hasExistingMasterFile }: SessionInitModalProps) {
  const [userName, setUserName] = useState("");
  const [fileData, setFileData] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError("Veuillez saisir votre nom d'utilisateur pour démarrer la session.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onStartSession(userName.trim(), fileData);
    } catch (err: any) {
      setError(err.message || "Erreur lors du démarrage de la session.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" id="session-init-modal-overlay">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden" id="session-init-modal-card">

        {/* Modal Header */}
        <div className="bg-brand-purple dark:bg-slate-950 text-white p-5 space-y-1 text-center relative">
          <div className="mx-auto w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-2 text-brand-lime">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold tracking-tight">
            Évaluateur de tarif du marché reconditionné
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Ouverture de session & Synchronisation Base de Données
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* User Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="w-4 h-4 text-brand-purple dark:text-brand-lime" />
              <span>Nom de l'utilisateur / Opérateur *</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-purple dark:focus:ring-brand-lime transition-all"
              placeholder="Ex: Jean Dupont"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Excel File Import Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Base de Données Excel (DataBase_PrixPc_refurb.xlsx)</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                fileName
                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : "border-slate-300 dark:border-slate-700 hover:border-brand-purple dark:hover:border-brand-lime bg-slate-50/50 dark:bg-slate-950/50"
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-center space-x-2 text-emerald-700 dark:text-emerald-400 font-medium text-xs">
                  <Check className="w-4 h-4" />
                  <span className="truncate max-w-[240px] font-mono">{fileName}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-5 h-5 mx-auto text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cliquer pour sélectionner le fichier Excel maître
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    {hasExistingMasterFile
                      ? "Un fichier maître existant sur le serveur sera utilisé par défaut si aucun fichier n'est sélectionné."
                      : "Le fichier DataBase_PrixPc_refurb.xlsx chargera 100% de l'historique."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !userName.trim()}
              className={`w-full py-2.5 px-4 bg-brand-purple hover:bg-brand-purple-hover dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center space-x-2 ${
                loading || !userName.trim() ? "opacity-50 cursor-not-allowed" : "active:scale-98"
              }`}
            >
              <span>{loading ? "Chargement de la session..." : "Démarrer la session"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
