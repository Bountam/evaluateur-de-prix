import React, { useState, useRef } from "react";
import { Download, Check, AlertTriangle, RefreshCw, Upload, Database, Archive } from "lucide-react";

interface ExportPanelProps {
  onExport: (targetPath: string) => Promise<{ success: boolean; simulatedPath: string; downloadUrl: string; count: number }>;
  onImport?: (fileData: string) => Promise<{ success: boolean; count: number; message: string }>;
}

export default function ExportPanel({ onExport, onImport }: ExportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    success: boolean;
    simulatedPath: string;
    downloadUrl: string;
    count: number;
    fileName: string;
    errorMessage?: string;
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
          fileName: "Export_Donnees_Brutes.xlsx"
        });
      } else {
        setResult({
          success: false,
          simulatedPath: "",
          downloadUrl: "",
          count: 0,
          fileName: "",
          errorMessage: "Échec de la génération du fichier sur le serveur."
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        simulatedPath: "",
        downloadUrl: "",
        count: 0,
        fileName: "",
        errorMessage: err.message || "Erreur de connexion lors de l'exportation."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBlob = async () => {
    setDownloading(true);
    setResult(null);
    try {
      const res = await fetch("/api/download-excel");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Fichier indisponible sur le serveur (Code HTTP ${res.status}). Veuillez d'abord générer l'export.`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Export_Donnees_Brutes.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setResult({
        success: false,
        simulatedPath: "",
        downloadUrl: "",
        count: 0,
        fileName: "",
        errorMessage: err.message || "Échec du téléchargement du fichier Excel."
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;

    // Validation client-side 1: Extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setImportResult({
        success: false,
        message: "Veuillez sélectionner un fichier Excel valide (.xlsx ou .xls).",
        count: 0
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validation client-side 2: Taille (< 20 Mo)
    if (file.size > 20 * 1024 * 1024) {
      setImportResult({
        success: false,
        message: "Fichier trop volumineux. La taille maximale autorisée est de 20 Mo.",
        count: 0
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = event.target?.result as string;
        const res = await onImport(base64Data);
        setImportResult(res);
      } catch (err: any) {
        setImportResult({
          success: false,
          message: err.message || "Échec du traitement du fichier Excel.",
          count: 0
        });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setImportResult({
        success: false,
        message: "Erreur de lecture du fichier local.",
        count: 0
      });
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          Importez vos données manuellement depuis <strong>Import_Manuel.xlsx</strong> ou générez votre fichier de sauvegarde (.xlsx).
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
              aria-label="Sélectionner le fichier Excel d'importation"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              aria-busy={importing}
              aria-label="Choisir et importer le fichier Import_Manuel.xlsx"
              className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center space-x-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
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
                role="status"
                aria-live="polite"
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
                  Générer le <strong>fichier Excel (.xlsx)</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleExport}
                disabled={loading || downloading}
                aria-busy={loading}
                aria-label="Générer l'exportation Excel complète"
                className={`w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center space-x-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                  loading ? "opacity-75 cursor-not-allowed" : "active:scale-98"
                }`}
                id="btn-trigger-export"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4" />
                    <span>Génération du fichier Excel...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>Générer Export_Donnees_Brutes.xlsx</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadBlob}
                disabled={downloading || loading}
                aria-busy={downloading}
                aria-label="Télécharger le fichier Excel directement"
                className={`w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center space-x-2 text-center focus:ring-2 focus:ring-slate-400 focus:outline-none ${
                  downloading ? "opacity-75 cursor-not-allowed" : "active:scale-98"
                }`}
                id="btn-direct-download-excel"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Téléchargement en cours...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Télécharger le fichier Excel</span>
                  </>
                )}
              </button>
            </div>

            {result && (
              <div
                role="status"
                aria-live="polite"
                className={`p-3 rounded-lg text-xs font-medium space-y-2 animate-fadeIn ${
                  result.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-rose-50 text-rose-900 border border-rose-200"
                }`}
                id="export-result-feedback"
              >
                {result.success ? (
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">Fichier Excel généré avec succès ! ({result.count} modèles)</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{result.errorMessage || "Erreur lors de la génération du fichier Excel."}</span>
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

