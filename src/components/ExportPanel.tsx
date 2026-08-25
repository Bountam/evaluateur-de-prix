import React, { useState, useRef } from "react";
import { Download, Check, AlertTriangle, RefreshCw, Upload, Database, Archive } from "lucide-react";

interface ExportPanelProps {
  onExport: (targetPath: string) => Promise<{ success: boolean; simulatedPath: string; downloadUrl: string; count: number }>;
  onImport?: (fileData: string) => Promise<{ success: boolean; count: number; message: string }>;
}

export default function ExportPanel({ onExport, onImport }: ExportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const data = await onExport("");
      if (data.success) {
        setResult({
          success: true,
          simulatedPath: data.simulatedPath,
          downloadUrl: data.downloadUrl,
          count: data.count,
          fileName: "Export_Donnees_Brutes.zip"
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = event.target?.result as string;
        const res = await onImport(base64Data);
        setImportResult(res);
      } catch (err: any) {
        setImportResult({ success: false, message: "Échec du chargement du fichier Excel.", count: 0 });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-2" id="export-panel-container">
      {/* Title */}
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center justify-center space-x-2">
          <Database className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
          <span>Gestion de la Base de Données</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Importez vos données manuellement depuis <strong>Import_Manuel.xlsx</strong> ou générez votre archive brute (CSV).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: IMPORTATION */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  1. Importer la Base de Données
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Charger le fichier <strong>Import_Manuel.xlsx</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
              Sélectionnez le fichier <strong>Import_Manuel.xlsx</strong> pour intégrer vos propres données à l'application. 
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
              id="excel-file-input"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center space-x-2 ${
                importing ? "opacity-75 cursor-not-allowed" : "active:scale-98"
              }`}
              id="btn-trigger-import"
            >
              {importing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  <span>Importation en cours...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Choisir Import_Manuel.xlsx</span>
                </>
              )}
            </button>

            {importResult && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-start space-x-2 animate-fadeIn ${
                  importResult.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-rose-50 text-rose-900 border border-rose-200"
                }`}
              >
                {importResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{importResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: EXPORTATION */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  2. Exporter & Télécharger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Générer le <strong>fichier ZIP (CSV)</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleExport}
                disabled={loading}
                className={`w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center space-x-2 ${
                  loading ? "opacity-75 cursor-not-allowed" : "active:scale-98"
                }`}
                id="btn-trigger-export"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4" />
                    <span>Génération de l'archive...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>Générer Export_Donnees_Brutes.zip</span>
                  </>
                )}
              </button>

              <a
                href="/api/download-excel"
                download="Export_Donnees_Brutes.zip"
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 text-center"
                id="btn-direct-download-excel"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Télécharger l'archive ZIP</span>
              </a>
            </div>

            {result && (
              <div
                className={`p-3 rounded-lg text-xs font-medium space-y-2 animate-fadeIn ${
                  result.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-rose-50 text-rose-900 border border-rose-200"
                }`}
                id="export-result-feedback"
              >
                {result.success ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold">Archive générée avec succès ! ({result.count} modèles)</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Erreur lors de la génération de l'archive.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
