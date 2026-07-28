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

## 📦 Build de Production

```bash
npm run build   # Compile frontend (Vite → dist/) + backend (esbuild → dist/server.js)
npm start       # Lance la version compilée
```

---

## 📂 Structure du Projet

```
évaluateur-de-prix-insertech/
├── server.ts               # Serveur Express principal (API REST + routes export)
├── index.html              # Point d'entrée Vite
├── vite.config.ts          # Configuration Vite
├── tsconfig.json           # Configuration TypeScript
├── package.json            # Scripts de build et dépendances
├── .env.example            # Modèle de variables d'environnement
│
├── src/                    # Frontend React
│   ├── App.tsx             # Gestionnaire d'état principal + routes API clientes
│   ├── types.ts            # Interfaces TypeScript partagées
│   ├── modelsData.ts       # Catalogue maître des modèles par catégorie
│   ├── index.css           # Styles globaux + thème light/dark
│   └── components/
│       ├── ModelDetail.tsx     # Fiche de modèle + journal de diagnostic
│       ├── Sidebar.tsx         # Navigation latérale (modèles par marque)
│       ├── SyntheseTab.tsx     # Tableau de bord synthèse global
│       ├── SourcesTab.tsx      # Statut des 16 sources de données
│       ├── GcsurplusTab.tsx    # Tableau des lots GCSurplus
│       ├── HistoriqueTab.tsx   # Journal d'audit comptable
│       ├── EcartsTab.tsx       # Analyse des écarts de prix
│       ├── ExportPanel.tsx     # Panneau de génération du rapport Excel
│       ├── ConfigPanel.tsx     # Configuration de l'application
│       ├── AddModelModal.tsx   # Ajout de modèle personnalisé
│       └── Logo.tsx            # Logo Insertech
│
├── scrapers/               # Moteur de scraping multi-sources
│   ├── orchestrator.ts     # Orchestrateur central (IQR, déduplication, médiane)
│   ├── types.ts            # Interfaces TypeScript du moteur de scraping
│   ├── utils.ts            # Parseurs de prix, filtres de pièces, extraction de specs
│   ├── cache.ts            # Système de cache Tier 3 (par source/modèle)
│   ├── browser-emulator.ts # Émulation d'en-têtes navigateur & rotation User-Agent
│   ├── credentials.ts      # Gestion sécurisée des identifiants (GCSurplus, etc.)
│   ├── ebay-completed.ts   # eBay ventes complétées (prix réels du marché)
│   ├── ebay-active.ts      # eBay annonces actives
│   ├── backmarket.ts       # Back Market Canada
│   ├── reebelo.ts          # Reebelo Canada
│   ├── amazon-renewed.ts   # Amazon Renewed Canada
│   ├── bestbuy.ts          # Best Buy Canada (Marketplace)
│   ├── newegg.ts           # Newegg Canada (Refurbished)
│   ├── refurb-io.ts        # Refurb.io Canada
│   ├── walmart.ts          # Walmart Canada (Restored)
│   ├── dell.ts             # Dell Refurbished Canada
│   ├── it-refurbs.ts       # IT Refurbs Canada
│   ├── canada-computers.ts # Canada Computers (Refurbished)
│   ├── gcsurplus.ts        # GCSurplus (lots gouvernementaux, session authentifiée)
│   ├── seao.ts             # SEAO (appels d'offres publics québécois)
│   ├── insertech-internal.ts  # Stock actuel Insertech
│   └── insertech-archives.ts  # Archives des analyses antérieures Insertech
│
├── data/
│   └── scraper-cache/      # Cache JSON individuel par source/modèle (Tier 3)
│
├── db.json                 # Base de données locale (évaluations, logs, sources)
├── metadata.json           # Métadonnées de version
├── insertech_logo.png      # Logo Insertech
└── exports/                # Rapports Excel générés (dossier auto-créé, ignoré par Git)
```

---

## 🤝 Conventions & Bonnes Pratiques

- **Conventional Commits :** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Ajout de scraper :** Implémenter l'interface `ScraperModule` de `scrapers/types.ts`, enregistrer dans `ALL_SCRAPERS` de `orchestrator.ts`, et ajouter la source dans `seedDatabase()` de `server.ts`.
- **Robustesse :** Chaque scraper doit avoir un `try/catch` global et appeler le cache Tier 3 en cas d'erreur. Aucune exception bloquante ne doit remonter à l'orchestrateur.
- **Cache :** Les fichiers de cache (`data/scraper-cache/*.json`) sont gérés automatiquement et ignorés par Git.
