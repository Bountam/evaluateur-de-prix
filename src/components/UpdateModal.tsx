import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  ArrowUpCircle,
  X,
  ShieldCheck,
  Download,
  AlertTriangle,
  ExternalLink,
  CheckCircle2
} from "lucide-react";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
}

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  sha256?: string;
  packageType?: "portable" | "source" | "none";
  canAutoInstall?: boolean;
  autoInstallBlockedReason?: string;
  githubUrl?: string;
  publishedAt?: string;
  lastChecked?: string;
}

interface UpdateFeedback {
  type: "info" | "success" | "error" | "warning";
  text: string;
}

export default function UpdateModal({ isOpen, onClose, currentVersion }: UpdateModalProps) {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState(60);
  const [updateFeedback, setUpdateFeedback] = useState<UpdateFeedback | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const pollForServerRestart = (targetVersion?: string) => {
    setRestarting(true);
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    setReconnectCountdown(60);

    const interval = setInterval(async () => {
      attempts++;
      setReconnectCountdown(Math.max(0, 60 - attempts * 2));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch("/api/version", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.version) {
            clearInterval(interval);
            pollTimerRef.current = null;
            setUpdateFeedback({
              type: "success",
              text: `✅ Serveur reconnecté avec succès ! Version active : v${data.version}. Rechargement...`
            });
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            return;
          }
        }
      } catch {
        // Le serveur est en cours de redémarrage (déconnexion normale)
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        pollTimerRef.current = null;
        setRestarting(false);
        setUpdateFeedback({
          type: "warning",
          text: "⚠️ Le serveur prend du temps à redémarrer. Veuillez rafraîchir la page manuellement (F5) ou relancer l'application."
        });
      }
    }, 2000);

    pollTimerRef.current = interval;
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateFeedback(null);
    try {
      const res = await fetch("/api/check-update");
      const data = await res.json();
      if (data.success) {
        setUpdateInfo({
          hasUpdate: data.hasUpdate,
          latestVersion: data.latestVersion,
          releaseNotes: data.releaseNotes,
          downloadUrl: data.downloadUrl,
          sha256: data.sha256,
          packageType: data.packageType,
          canAutoInstall: data.canAutoInstall,
          autoInstallBlockedReason: data.autoInstallBlockedReason,
          githubUrl: data.githubUrl,
          publishedAt: data.publishedAt,
          lastChecked: new Date().toLocaleTimeString("fr-CA")
        });
      } else {
        setUpdateFeedback({
          type: "error",
          text: data.releaseNotes || "Erreur lors de la vérification de mise à jour."
        });
      }
    } catch {
      setUpdateInfo({
        hasUpdate: false,
        latestVersion: currentVersion,
        releaseNotes: "Impossible de contacter le registre de mise à jour distant."
      });
    } finally {
      setChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;
    setUpdating(true);
    setUpdateFeedback({
      type: "info",
      text: "Téléchargement sécurisé et vérification de l'archive en cours..."
    });

    try {
      const res = await fetch("/api/perform-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downloadUrl: updateInfo.downloadUrl,
          sha256: updateInfo.sha256
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.restarting) {
          setUpdateFeedback({
            type: "info",
            text: "🔄 Mise à jour déployée. Le serveur redémarre, reconnexion automatique en cours..."
          });
          pollForServerRestart(updateInfo.latestVersion);
        } else {
          setUpdateFeedback({
            type: "success",
            text: `✅ ${data.message || "Mise à jour installée avec succès ! Veuillez relancer l'application."}`
          });
        }
      } else {
        setUpdateFeedback({
          type: "error",
          text: `⚠️ ${data.error || "Échec de l'installation."}`
        });
      }
    } catch (e: any) {
      setUpdateFeedback({
        type: "error",
        text: `⚠️ Erreur de communication : ${e.message}`
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg text-purple-700 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Mises à Jour Automatiques GitHub
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Évaluateur Insertech — Version actuelle <span className="font-mono font-bold text-purple-600 dark:text-purple-400">v{currentVersion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={restarting}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Version installée :</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                v{currentVersion}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Canal de mise à jour :</span>
              <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">GitHub Releases API</span>
            </div>
          </div>

          {updateFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold ${
                updateFeedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : updateFeedback.type === "error"
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                  : updateFeedback.type === "warning"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                  : "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300"
              }`}
            >
              {updateFeedback.text}
            </div>
          )}

          {restarting && (
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 space-y-2 text-center">
              <div className="flex items-center justify-center space-x-2 font-bold text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400" />
                <span>Reconnexion au serveur en cours...</span>
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-300/80">
                Temps d'attente estimé : <span className="font-mono font-bold">{reconnectCountdown}s</span>
              </p>
            </div>
          )}

          {updateInfo ? (
            updateInfo.hasUpdate ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 space-y-3">
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <ArrowUpCircle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                  <span>Nouvelle version disponible : v{updateInfo.latestVersion} !</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400/90 pl-6 whitespace-pre-line">
                  {updateInfo.releaseNotes}
                </p>

                {updateInfo.canAutoInstall && updateInfo.downloadUrl ? (
                  <button
                    onClick={handleApplyUpdate}
                    disabled={updating || restarting}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 ${updating ? "animate-bounce" : ""}`} />
                    <span>{updating ? "Téléchargement & Installation..." : `Télécharger et Installer v${updateInfo.latestVersion}`}</span>
                  </button>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-amber-200 dark:border-amber-800/40">
                    {updateInfo.autoInstallBlockedReason && (
                      <div className="flex items-start space-x-2 text-[11px] text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{updateInfo.autoInstallBlockedReason}</span>
                      </div>
                    )}
                    {updateInfo.githubUrl && (
                      <a
                        href={updateInfo.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center space-x-1.5 w-full py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-100 dark:hover:bg-slate-700 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Voir la release sur GitHub</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Votre application est parfaitement à jour !</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400/90 pl-6">
                  {updateInfo.releaseNotes} {updateInfo.lastChecked ? `(Vérifié à ${updateInfo.lastChecked})` : ""}
                </p>
              </div>
            )
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic py-2">
              Cliquez ci-dessous pour interroger l'API GitHub Releases et détecter la présence d'une mise à jour.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={restarting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition disabled:opacity-40"
          >
            Fermer
          </button>
          <button
            onClick={handleCheckUpdate}
            disabled={checking || updating || restarting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600 font-bold rounded-lg text-xs tracking-wider uppercase shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
            <span>{checking ? "Vérification..." : "Vérifier sur GitHub"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
