import React from "react";
import { Download, UserX, X, HelpCircle, FileSpreadsheet } from "lucide-react";

interface UserSwitchModalProps {
  isOpen: boolean;
  currentUser: string;
  onClose: () => void;
  onExportAndSwitch: () => Promise<void>;
  onSwitchWithoutExport: () => void;
}

export default function UserSwitchModal({
  isOpen,
  currentUser,
  onClose,
  onExportAndSwitch,
  onSwitchWithoutExport
}: UserSwitchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" id="user-switch-modal-overlay">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden" id="user-switch-modal-card">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center space-x-2">
            <UserX className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Changer d'utilisateur / Fin de session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start space-x-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-3.5 rounded-lg text-xs text-amber-900 dark:text-amber-200">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Session actuelle : <span className="underline">{currentUser}</span></p>
              <p className="mt-1 leading-relaxed">
                Souhaitez-vous sauvegarder et exporter la base de données maître (<strong>DataBase_PrixPc_refurb.xlsx</strong>) avant de changer d'utilisateur ?
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={onExportAndSwitch}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter la base de données & Changer</span>
            </button>

            <button
              onClick={onSwitchWithoutExport}
              className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              <UserX className="w-4 h-4" />
              <span>Changer d'utilisateur sans exporter</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-transparent border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold text-xs cursor-pointer transition-all active:scale-98"
            >
              Annuler
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
