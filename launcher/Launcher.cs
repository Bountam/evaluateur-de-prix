using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace EvaluateurPrix
{
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        private const int SW_RESTORE = 9;
        private const string MUTEX_NAME = @"Local\EvaluateurPrixLauncherMutex";

        private static IntPtr foundExistingHwnd = IntPtr.Zero;

        [STAThread]
        static void Main()
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, MUTEX_NAME, out createdNew))
            {
                if (!createdNew)
                {
                    // Une instance est déjà en cours d'exécution : amener la fenêtre au premier plan
                    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
                    {
                        if (IsWindowVisible(hWnd))
                        {
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hWnd, sb, sb.Capacity);
                            string title = sb.ToString();
                            if (title.IndexOf("Évaluateur", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                title.IndexOf("Insertech", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                foundExistingHwnd = hWnd;
                                return false; // Stop enumeration
                            }
                        }
                        return true;
                    }, IntPtr.Zero);

                    if (foundExistingHwnd != IntPtr.Zero)
                    {
                        ShowWindow(foundExistingHwnd, SW_RESTORE);
                        SetForegroundWindow(foundExistingHwnd);
                    }
                    return;
                }

                string rootDir = AppDomain.CurrentDomain.BaseDirectory;
                string appDir = Path.Combine(rootDir, "app");
                if (Directory.Exists(appDir))
                {
                    try
                    {
                        FileAttributes attr = File.GetAttributes(appDir);
                        if ((attr & FileAttributes.Hidden) == 0)
                        {
                            File.SetAttributes(appDir, attr | FileAttributes.Hidden);
                        }
                    }
                    catch { }
                }
                else
                {
                    appDir = rootDir;
                }

                // 1. Nettoyer tout verrou antérieur éventuel
                string pidFile = Path.Combine(appDir, ".server.pid");
                string portFile = Path.Combine(appDir, ".server.port");

                if (File.Exists(pidFile))
                {
                    try
                    {
                        string pidStr = File.ReadAllText(pidFile).Trim();
                        int oldPid;
                        if (int.TryParse(pidStr, out oldPid) && oldPid > 0)
                        {
                            try
                            {
                                Process oldProc = Process.GetProcessById(oldPid);
                                if (oldProc != null && !oldProc.HasExited)
                                {
                                    oldProc.Kill();
                                    oldProc.WaitForExit(2000);
                                }
                            }
                            catch { }
                        }
                        File.Delete(pidFile);
                    }
                    catch { }
                }

                if (File.Exists(portFile))
                {
                    try { File.Delete(portFile); } catch { }
                }

                // 2. Localiser Node.js
                string nodeExe = Path.Combine(appDir, "node.exe");
                if (!File.Exists(nodeExe))
                {
                    nodeExe = Path.Combine(rootDir, "node.exe");
                    if (!File.Exists(nodeExe))
                    {
                        nodeExe = "node";
                    }
                }

                string serverJs = Path.Combine(appDir, "dist", "server.js");
                if (!File.Exists(serverJs))
                {
                    serverJs = Path.Combine(rootDir, "dist", "server.js");
                }

                if (!File.Exists(serverJs))
                {
                    MessageBox.Show(
                        "Fichier serveur introuvable :\n" + serverJs + "\n\nVeuillez vérifier l'intégrité du package portable.",
                        "Évaluateur de Prix - Erreur",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // 3. Jeton de sécurité pour arrêt gracieux
                string shutdownToken = Guid.NewGuid().ToString("N");

                // 4. Démarrer le serveur Node.js en arrière-plan sans console
                ProcessStartInfo psiNode = new ProcessStartInfo();
                psiNode.FileName = nodeExe;
                psiNode.Arguments = "\"" + serverJs + "\"";
                psiNode.WorkingDirectory = appDir;
                psiNode.CreateNoWindow = true;
                psiNode.WindowStyle = ProcessWindowStyle.Hidden;
                psiNode.UseShellExecute = false;

                psiNode.EnvironmentVariables["NODE_ENV"] = "production";
                psiNode.EnvironmentVariables["HOST"] = "127.0.0.1";
                psiNode.EnvironmentVariables["APP_SHUTDOWN_TOKEN"] = shutdownToken;
                psiNode.EnvironmentVariables["INSERTECH_SHUTDOWN_TOKEN"] = shutdownToken;

                string chromiumExe = Path.Combine(appDir, "chromium", "chrome.exe");
                if (File.Exists(chromiumExe))
                {
                    psiNode.EnvironmentVariables["CHROMIUM_PATH"] = chromiumExe;
                }

                Process nodeProcess = null;
                try
                {
                    nodeProcess = Process.Start(psiNode);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(
                        "Impossible de lancer Node.js :\n" + ex.Message + "\n\nChemin : " + nodeExe,
                        "Évaluateur de Prix - Erreur",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                // 5. Attendre activement que le serveur réponde sur son port
                string targetPort = "3000";
                bool serverReady = false;
                int waitAttempts = 0;

                while (!serverReady && waitAttempts < 80)
                {
                    Thread.Sleep(500);
                    waitAttempts++;

                    if (File.Exists(portFile))
                    {
                        try
                        {
                            string p = File.ReadAllText(portFile).Trim();
                            int pNum;
                            if (int.TryParse(p, out pNum) && pNum > 0)
                            {
                                targetPort = p;
                            }
                        }
                        catch { }
                    }

                    try
                    {
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + targetPort + "/api/version");
                        req.Timeout = 800;
                        req.Method = "GET";
                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        {
                            if (resp.StatusCode == HttpStatusCode.OK)
                            {
                                serverReady = true;
                            }
                        }
                    }
                    catch { }

                    if (nodeProcess.HasExited)
                    {
                        MessageBox.Show(
                            "Le serveur de l'application s'est arrêté de manière inattendue.\nCode de sortie : " + nodeProcess.ExitCode,
                            "Évaluateur de Prix - Erreur",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return;
                    }
                }

                if (!serverReady)
                {
                    MessageBox.Show(
                        "Le serveur met trop de temps à répondre. Vérifiez les journaux dans app\\logs.",
                        "Évaluateur de Prix - Délai dépassé",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                // 6. Ouvrir Microsoft Edge en mode App autonome
                string targetUrl = "http://127.0.0.1:" + targetPort;
                string edge64 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
                string edge32 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
                string edgePath = File.Exists(edge64) ? edge64 : (File.Exists(edge32) ? edge32 : null);

                Process browserProcess = null;
                if (edgePath != null)
                {
                    string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"EvaluateurPrix\browser-profile");
                    ProcessStartInfo psiEdge = new ProcessStartInfo();
                    psiEdge.FileName = edgePath;
                    psiEdge.Arguments = "--app=\"" + targetUrl + "\" --disable-http-cache --disk-cache-size=1 --user-data-dir=\"" + profileDir + "\" --no-first-run --no-default-browser-check";
                    psiEdge.UseShellExecute = false;
                    try
                    {
                        browserProcess = Process.Start(psiEdge);
                    }
                    catch { }
                }

                if (browserProcess == null)
                {
                    // Repli sur le navigateur par défaut
                    Process.Start(targetUrl);
                }

                // 7. Attendre la fermeture de la fenêtre de l'application
                if (browserProcess != null)
                {
                    browserProcess.WaitForExit();
                }
                else
                {
                    // Si Edge n'était pas disponible, attendre la terminaison du serveur ou événement système
                    nodeProcess.WaitForExit();
                }

                // 8. Arrêt gracieux du serveur Node.js via l'endpoint sécurisé
                try
                {
                    HttpWebRequest shutdownReq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + targetPort + "/api/system/shutdown");
                    shutdownReq.Method = "POST";
                    shutdownReq.Timeout = 3000;
                    shutdownReq.Headers.Add("X-Shutdown-Token", shutdownToken);
                    shutdownReq.ContentLength = 0;
                    using (HttpWebResponse sResp = (HttpWebResponse)shutdownReq.GetResponse()) { }
                }
                catch { }

                // Laisser jusqu'à 3 secondes à Node pour finaliser SQLite et Playwright
                if (!nodeProcess.WaitForExit(3000))
                {
                    try
                    {
                        nodeProcess.Kill();
                    }
                    catch { }
                }

                // Nettoyage final des fichiers temporaires
                try { if (File.Exists(pidFile)) File.Delete(pidFile); } catch { }
                try { if (File.Exists(portFile)) File.Delete(portFile); } catch { }
            }
        }
    }
}
