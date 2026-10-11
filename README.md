# 🖥️ Évaluateur de Prix Insertech

Plateforme d'automatisation, d'analyse et d'évaluation de la juste valeur marchande d'équipements informatiques d'occasion pour **Insertech** (organisme de reconditionnement informatique à Montréal, Québec).

Ce projet scrape en temps réel **16 sources de tarification** du marché secondaire canadien, filtre les valeurs aberrantes (outliers), détecte les pièces détachées et calcule un prix médian fiable par modèle. Il génère ensuite un rapport Excel en 8 feuilles conforme aux normes d'audit comptable d'Insertech.

---

## 🌟 Fonctionnalités Clés

### 🔍 Scraping Multi-Sources — 16 connecteurs actifs
| Catégorie | Sources |
|---|---|
| **Marché secondaire** | eBay (ventes complétées & annonces actives) |
| **Reconditionneurs certifiés** | Back Market, Reebelo, Amazon Renewed, Best Buy, Newegg Canada, Refurb.io, Walmart Canada, IT Refurbs Canada, Canada Computers, Dell Refurbished |
| **Enchères gouvernementales** | GCSurplus (lots publics authentifiés) |
| **SEAO** | Appels d'offres publics québécois |
| **Interne Insertech** | Stock actuel (Insertech Internal), archives historiques d'analyses |

### 🗂️ Catalogue de modèles surveillés
- **Portables Lenovo :** ThinkPad T480/T490/T14, L480/L490, E480/E490, X390, X13, X1 Carbon Gen 6+, E14 Gen 4
- **Portables Dell :** Latitude 5400–5530, 7300–7420, Dell XPS 13/15/17 (séries 9300–9730)
- **Portables HP :** EliteBook 840/850 G5–G8, ProBook 440/450 G5+
- **Apple :** MacBook Air (Intel, M1, M2), MacBook Pro (Intel, M1, M2)
- **Desktop Lenovo :** ThinkCentre M720/M920/M70q/M80q/M90q
- **Desktop Dell :** OptiPlex 3060–7080
- **Desktop HP :** EliteDesk 800 G4–G6, ProDesk 600 G4–G5
- **Mobiles :** iPhone 11 → 15 Pro Max (toutes variantes)

### 🧠 Architecture de Scraping à 3 Niveaux (Tiers)
- **Tier 1 :** Requête directe avec émulation d'en-têtes navigateur et rotation de User-Agents
- **Tier 2 :** Repli sur flux RSS, API Next.js ou JSON embarqué selon la source
- **Tier 3 :** Cache local segmenté (`data/scraper-cache/`) — garantit un retour de données continu (listings marqués `isSimulated`)

### 📊 Filtrage & Analyse Avancés
- **Normalisation des modèles :** Résolution automatique des codes constructeurs (ex: `Dell XPS 15 P129F001` → `Dell XPS 15 9500`)
- **Détecteur de pièces (`isPartOrAssembly`) :** Exclusion sémantique des composants isolés (écrans seuls, batteries, chargeurs, boîtes vides)
- **Exclusion des outliers (IQR) :** Méthode mathématique de l'Écart Interquartile avec seuil minimum de 15 $
- **Filtre de génération CPU :** Exclusion automatique des processeurs 7e génération et antérieurs (`no ram`, `broken`, `grade d`, etc.)
- **Filtre de modèle strict :** Élimination des faux positifs (ex: XPS 15 7590 vs XPS 17 9730)
- **Score de confiance :** Élevé / Moyen / Faible selon le volume de comparables et la diversité des sources

### 🖥️ Interface Utilisateur (React + Vite + Tailwind)
- Sidebar de navigation par marque/modèle avec modèles personnalisés ajoutables
- Tableau de bord **Synthèse** avec statistiques globales par catégorie
- Fiche de modèle avec journal de diagnostic en temps réel (barres de progression par source)
- **Validation humaine :** Double-clic sur un comparable pour l'exclure/inclure ; recalcul immédiat de la médiane
- **Édition inline :** Configuration, condition et commentaires modifiables directement dans la fiche
- Onglets **GCSurplus**, **Sources**, **Historique** et **Écarts**
- Thème Clair / Sombre persistant (localStorage)
- Exportation Excel en un clic (classeur de 8 feuilles)

---

## 📋 Prérequis

- **Node.js :** v18.x ou supérieur
- **npm** ou **bun** comme gestionnaire de paquets

---

## 🚀 Installation & Configuration

1. **Cloner ou récupérer le répertoire du projet :**
   ```bash
   cd évaluateur-de-prix-insertech
   ```

2. **Installer les dépendances :**
   ```bash
   npm install
   # ou
   bun install
   ```

3. **Configurer les variables d'environnement :**
   Créez un fichier `.env` à la racine sur le modèle de `.env.example` :
   ```env
   # Identifiants GCSurplus (pour le scraping des lots gouvernementaux)
   GCSURPLUS_USERNAME="votre_utilisateur"
   GCSURPLUS_PASSWORD="votre_mot_de_passe"

   # Chemin vers les fichiers internes Insertech (stock actuel + archives)
   INSERTECH_DATA_PATH="data/insertech-prices.xlsx"
   INSERTECH_ARCHIVES_PATH="data/archives/"
   ```

---

## 🛠️ Développement

```bash
npm run dev
```

Démarre le serveur Express + Vite HMR sur **`http://localhost:3000`**.

---

## 📦 Build & Déploiement

### 1. Build standard (Frontend + Backend)
```bash
npm run build   # Compile le frontend (Vite → dist/) + le backend (esbuild → dist/server.js)
npm start       # Lance la version compilée sur http://127.0.0.1:3000
```

### 2. Packaging autonome portable (Zéro-Dépendance)
```bash
npm run build:executable   # Génère le dossier 'evaluateur-insertech-portable' et l'archive ZIP autonome
```

### 3. Lanceurs rapides Windows
- **`Lancer-Insertech.bat`** (ou `Lancer-Insertech-GUI.vbs`) : Lanceur silencieux sans console noire. Intègre une **attente active HTTP** sur `/api/version` qui synchronise l'ouverture de la fenêtre Edge uniquement lorsque le serveur Node.js et la base SQLite sont 100 % opérationnels (élimine tout risque de `ERR_CONNECTION_REFUSED`).
- **`start-prod.bat`** : Lanceur batch de production avec redémarrage automatique en cas d'arrêt et ouverture de navigateur synchronisée (`AUTO_OPEN=true`).

---

## 🧪 Tests & Qualité de Code

```bash
npm test        # Exécute la suite complète de 128 tests unitaires et d'intégration Vitest
npm run lint    # Contrôle strict des types TypeScript (tsc --noEmit)
npm run build   # Validation de compilation et génération des bundles de production
```

---

## 📂 Structure du Projet

```
évaluateur-de-prix-insertech/
├── server.ts                   # Point d'entrée serveur (délègue à server/)
├── server/                     # Architecture modulaire du backend
│   ├── config/                 # Constantes, variables d'environnement, version dynamique
│   ├── database/               # Persistance SQLite WAL & verrous atomiques (withDBLock)
│   ├── middlewares/            # Journalisation Winston, compression, sécurité Helmet, rate-limit
│   ├── routes/                 # Routes REST modulaires (scraping, excel, system, etc.)
│   └── services/               # Services métier (excel.service, lifecycle.service, update.service, healing.service)
│
├── index.html                  # Point d'entrée Vite
├── vite.config.ts              # Configuration Vite + proxy API
├── tsconfig.json               # Configuration TypeScript
├── package.json                # Scripts de build, packaging et dépendances (0 vulnérabilité npm)
├── .env.example                # Modèle de variables d'environnement
│
├── src/                        # Frontend React 19 + Tailwind
│   ├── App.tsx                 # Gestionnaire d'état principal + synchronisation API
│   ├── types.ts                # Interfaces TypeScript partagées
│   ├── modelsData.ts           # Catalogue maître des modèles par catégorie
│   ├── index.css               # Styles globaux + thème sombre/clair
│   └── components/
│       ├── model-detail/       # Fiche de modèle décomposée (Header, Stats, Table, Sparkline, Monitor, Filters)
│       ├── UpdateModal.tsx     # Gestionnaire de mise à jour sécurisée & reconnexion automatique
│       ├── Sidebar.tsx         # Navigation latérale (modèles par marque)
│       ├── SyntheseTab.tsx     # Tableau de bord de synthèse globale
│       ├── SettingsTab.tsx     # Paramètres du système (concurrence CPU, thème, marque blanche, sources)
│       ├── HistoriqueTab.tsx   # Journal d'audit comptable
│       ├── EcartsTab.tsx       # Analyse des écarts de prix
│       ├── ExportPanel.tsx     # Panneau d'exportation Excel maître (ExcelJS)
│       ├── ConfigPanel.tsx     # Configuration et clés d'API
│       ├── AddModelModal.tsx   # Ajout de modèles personnalisés
│       └── Logo.tsx            # Logo officiel Insertech
│
├── scrapers/                   # Moteur de scraping multi-sources (16 connecteurs)
│   ├── orchestrator.ts         # Orchestrateur central (IQR, déduplication, médiane, régulation CPU)
│   ├── types.ts                # Interfaces TypeScript du moteur de scraping
│   ├── utils.ts                # Parseurs de prix CAD, filtres de pièces, extraction de specs
│   ├── cache.ts                # Système de cache Tier 3 (par source/modèle)
│   ├── browser-emulator.ts     # Émulation Playwright Stealth & rotation User-Agent
│   └── [connecteurs]...        # eBay, Back Market, Reebelo, Amazon, Best Buy, GCSurplus, etc.
│
├── tests/                      # Suite de tests Vitest (105 tests au vert)
│   ├── update-service.test.ts  # Validation anti-SSRF, SemVer, Zip-Slip, sanctuarisation zéro-perte
│   ├── e2e-business-lifecycle.test.ts # Cycle de vie serveur, arrêt gracieux et règles comptables
│   ├── excel-service.test.ts   # Aller-retour fidèle ExcelJS sans perte
│   ├── portable-packaging.test.ts # Scripts de packaging et lanceurs Windows/macOS
│   └── modular-server.test.ts  # Architecture serveur et persistance SQLite
│
├── data/                       # Base de données SQLite persistante (WAL mode)
│   ├── database.sqlite         # Base principale (sanctuarisée lors des mises à jour)
│   └── backups/                # Sauvegardes rotatives automatiques horodatées
│
├── scripts/                    # Scripts d'automatisation
│   └── build-executable.ts     # Packaging autonome portable zéro-dépendance
│
└── evaluateur-insertech-portable.zip # Package distribuable prêt pour l'atelier (~262 Mo)
```

---

## 🤝 Conventions & Bonnes Pratiques

- **Conventional Commits :** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Ajout de scraper :** Implémenter l'interface `ScraperModule` de `scrapers/types.ts`, enregistrer dans `ALL_SCRAPERS` de `orchestrator.ts`, et ajouter la source dans `seedDatabase()` de `server.ts`.
- **Robustesse :** Chaque scraper doit avoir un `try/catch` global et appeler le cache Tier 3 en cas d'erreur. Aucune exception bloquante ne doit remonter à l'orchestrateur.
- **Cache :** Les fichiers de cache (`data/scraper-cache/*.json`) sont gérés automatiquement et ignorés par Git.
