import React, { useState } from "react";
import { Download, FileSpreadsheet, Check, AlertTriangle, HelpCircle, FolderOpen, RefreshCw } from "lucide-react";

interface ExportPanelProps {
  onExport: (targetPath: string) => Promise<{ success: boolean; simulatedPath: string; downloadUrl: string; count: number }>;
}

const EXPORT_SHEETS = [
  { num: "1", label: "Synthèse", desc: "Indicateurs globaux du marché & statistiques par catégorie" },
  { num: "2", label: "Ordinateurs portables", desc: "Lenovo ThinkPad, Dell Latitude, HP EliteBook/ProBook, MacBook" },
  { num: "3", label: "Ordinateurs de bureau", desc: "Lenovo ThinkCentre, Dell OptiPlex, HP EliteDesk/ProDesk" },
  { num: "4", label: "iPhone", desc: "iPhone 11 → 15 Pro Max (toutes générations suivies)" },
  { num: "5", label: "GCSurplus", desc: "Lots gouvernementaux actifs (enchères publiques)" },
  { num: "6", label: "Sources", desc: "Statut des 16 connecteurs de données du marché secondaire" },
  { num: "7", label: "Historique", desc: "Journal d'audit comptable de toutes les modifications" },
  { num: "8", label: "Écarts de prix", desc: "Variations et tendances vs analyse précédente" },
];

export default function ExportPanel({ onExport }: ExportPanelProps) {
  const [exportPath, setExportPath] = useState(
    "I:\\Developpement_des_affaires\\1_Approvisionnement\\Documents\\Etude_de_prix\\"
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    simulatedPath: string;
    downloadUrl: string;
    count: number;
    fileName: string;
  } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await onExport(exportPath);
      if (data.success) {
        setResult({
          success: true,
          simulatedPath: data.simulatedPath,
          downloadUrl: data.downloadUrl,
          count: data.count,
          fileName: data.simulatedPath.split("\\").pop() || "rapport.xlsx"
        });
      } else {
        setResult({ success: false, simulatedPath: "", downloadUrl: "", count: 0, fileName: "" });
      }
    } catch {
      setResult({ success: false, simulatedPath: "", downloadUrl: "", count: 0, fileName: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 space-y-4 shadow-sm" id="export-panel-container">

      {/* Header */}
      <div className="flex items-start space-x-2.5 border-b border-[#F1F2F6] pb-3" id="export-header">
        <div className="p-2 bg-emerald-50 rounded text-emerald-600">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider mt-0.5">
            Rapport Excel — Étude de Marché Insertech
          </h2>
          <p className="text-[10px] text-[#7F8C8D] mt-0.5 font-medium">
            Génère un classeur Excel structuré en 8 feuilles couvrant l'ensemble du catalogue suivi (portables, desktops, iPhone, GCSurplus), avec médianes, preuves URL et journal d'audit comptable.
          </p>
        </div>
      </div>

      {/* Sheet Preview */}
      <div className="space-y-1" id="export-sheets-preview">
        <p className="text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider">Contenu du classeur (8 feuilles)</p>
        <div className="grid grid-cols-2 gap-1">
          {EXPORT_SHEETS.map(sheet => (
            <div
              key={sheet.num}
              className="flex items-start space-x-1.5 bg-[#F8F9FA] rounded px-2 py-1.5 border border-[#DCDDE1]"
            >
              <span className="text-[9px] font-mono font-bold text-emerald-600 mt-px shrink-0">{sheet.num}.</span>
              <div>
                <p className="text-[9px] font-bold text-slate-700">{sheet.label}</p>
                <p className="text-[9px] text-slate-400 leading-tight">{sheet.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Destination Path */}
      <div className="space-y-1.5" id="export-path-section">
        <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider flex items-center space-x-1">
          <FolderOpen className="w-3 h-3" />
          <span>Dossier de destination (lecteur réseau Windows I:)</span>
          <HelpCircle
            className="w-3 h-3 text-slate-400 cursor-help"
            title="Chemin réseau Insertech — Developpement des affaires → Approvisionnement"
          />
        </label>
        <input
          type="text"
          className="w-full px-2.5 py-1.5 text-xs bg-[#F8F9FA] border border-[#DCDDE1] rounded font-mono text-slate-800 outline-none focus:bg-white focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
          value={exportPath}
          onChange={(e) => setExportPath(e.target.value)}
          id="export-path-input"
          placeholder="I:\Chemin\Vers\Dossier\"
        />
        <p className="text-[10px] text-[#7F8C8D] italic">
          Le fichier sera également disponible en téléchargement direct depuis le navigateur après génération.
        </p>
      </div>

      {/* Action Button */}
      <div className="flex items-center space-x-3 pt-1" id="export-actions">
        <button
          onClick={handleExport}
          disabled={loading}
          className={`flex items-center space-x-1.5 px-3 py-2 bg-brand-purple hover:bg-brand-purple-hover dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 text-white rounded-sm text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-sm transition-all ${
            loading ? "opacity-75 cursor-not-allowed" : "active:scale-95"
          }`}
          id="btn-trigger-export"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin h-3 w-3" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-3 h-3 text-[#2ECC71]" />
              <span>Générer le rapport Excel (.xlsx)</span>
            </>
          )}
        </button>
      </div>

      {/* Result Feedback */}
      {result && (
        <div
          className={`p-3 rounded-lg border flex items-start space-x-2.5 animate-fadeIn ${
            result.success
              ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
              : "bg-rose-50/50 border-rose-200 text-slate-800"
          }`}
          id="export-result-feedback"
        >
          {result.success ? (
            <>
              <div className="p-1 bg-emerald-100 rounded-full text-emerald-700 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider font-mono">
                    Rapport généré avec succès !
                  </h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Classeur de <strong>{result.count} modèles évalués</strong> en 8 feuilles —{" "}
                    portables, desktops, iPhones, GCSurplus, sources et audit.
                  </p>
                </div>
                <div className="bg-white border border-emerald-100 rounded p-2 font-mono text-[10px] text-slate-700 break-all select-all">
                  📁 {result.simulatedPath}
                </div>
                <a
                  href={result.downloadUrl}
                  download={result.fileName}
                  className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline uppercase tracking-wide font-mono"
                  id="link-download-excel"
                >
                  <Download className="w-3 h-3" />
                  <span>Télécharger le classeur .XLSX</span>
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="p-1 bg-rose-100 rounded-full text-rose-700 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider font-mono">
                  Erreur de génération
                </h3>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Impossible de générer le rapport. Assurez-vous qu'au moins un modèle a été analysé et enregistré dans la base de données avant d'exporter.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
