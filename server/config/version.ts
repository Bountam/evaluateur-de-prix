// Version applicative unique, injectée au moment du bundle (esbuild inline le JSON).
// Fonctionne en développement (tsx), en tests (Vitest) et dans le package portable,
// qui ne contient pas de package.json à l'exécution.
import pkg from "../../package.json" with { type: "json" };

export const APP_VERSION: string = (pkg as { version?: string }).version || "0.0.0";
