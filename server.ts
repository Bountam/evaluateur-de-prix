// ─── Point d'Entrée Principal Serveur Insertech (Architecture Modulaire) ───

import { startServer } from "./server/index.ts";
export { normalizeCategory } from "./src/modelsData.ts";

startServer().catch((err) => {
  console.error("Échec critique du serveur Insertech:", err);
  process.exit(1);
});
