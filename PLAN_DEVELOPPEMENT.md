# 🗺️ Plan de Développement à Long Terme — Évaluateur de Prix Insertech

## 1. Vision et Objectifs Directeurs

L'**Évaluateur de Prix Insertech** est l'outil central utilisé par l'équipe de production et d'évaluation pour déterminer la juste valeur marchande (JVM) du matériel reconditionné conformément aux exigences d'audit comptable.

### Principes Fondamentaux de Conception :
1. **Priorité absolue aux résultats complets (Tolérance aux PC modestes) :**  
   > *« Mieux vaut obtenir des résultats qui prennent du temps que pas de résultats du tout. »*  
   Sur les ordinateurs plus lents ou disposant de ressources restreintes (CPU 2-4 cœurs, RAM limitée), les scrapers et processus d'analyse ne doivent jamais couper court prématurément par un timeout rigide. Les seuils de temps doivent être configurés de manière souple et non destructive.
2. **Garantie Zéro Perte des modèles personnalisés :**  
   Un modèle ajouté manuellement par un opérateur ne doit jamais être perdu. Il doit persister dans SQLite, être inclus dans le rapport Excel (feuilles catégorielles, inventaire global et feuille dédiée `Modèles Personnalisés`), et être fidèlement restauré et affiché lors de tout réimport ultérieur.
3. **Traçabilité et conformité comptable :**  
   Chaque évaluation doit conserver la date, l'opérateur, la liste exacte des comparables utilisés, les outliers exclus et le score de confiance statistique.

---

## 2. Phase 1 : Audit et Fiabilisation Individuelle des 16 Sources de Scraping

Chaque source de données sera auditée, fiabilisée et validée individuellement selon un protocole strict.

### Protocole d'audit par source :
- **Diagnostic de connectivité :** Vérification de l'URL cible, des flux RSS/API ou de la structure HTML actuelle (détection des sélecteurs devenus obsolètes).
- **Tolérance aux délais :** Remplacement des timeouts courts par des délais adaptatifs. Aucune source ne doit faire échouer la chaîne globale en cas de lenteur réseau ou CPU.
- **Résilience anti-blocage :** Utilisation de l'émulateur Playwright Stealth en arrière-plan sans blocage de verrou de profil sur Windows.
- **Cache Tier 3 de secours :** Garantie qu'en cas d'indisponibilité totale d'une source, le cache local (`data/scraper-cache/`) prend le relais en marquant la donnée `isSimulated: true`.
- **Tests unitaires dédiés :** Création d'une suite de tests Vitest avec fixtures réelles (HTML mockés) pour chaque source.

### Tableau de suivi des 16 sources :

| # | Source | Type de source | Méthode d'extraction | Statut d'audit | Risques & Actions requises |
|---|---|---|---|---|---|
| **01** | **eBay (Ventes Réussies)** | Marché secondaire | API Tier 1 + Parsing Cheerio + Cache | 🟢 Audité (Lot 1) | Sélecteurs `.s-card` unifiés ; détection proactive de la redirection login / Akamai sans blocage ; cascade propre vers Tier 2/3. |
| **02** | **eBay (Annonces Actives)** | Marché secondaire | API Tier 1 + Cheerio + Fallback US | 🟢 Audité (Lot 1) | Nouveaux sélecteurs `.s-card, .su-card-container` ; conversion USD→CAD ; détection Akamai sans gel ; relève Tier 2/3. |
| **03** | **Back Market Canada** | Reconditionneur pro | Playwright Stealth + Next.js data | 🟢 Fonctionnel (Lot 1) | 19+ annonces réelles extraites en 2,8s ; conversion dynamique USD→CAD opérationnelle. |
| **04** | **Reebelo Canada** | Reconditionneur pro | Playwright Stealth | 🟢 Fonctionnel (Lot 1) | 24+ annonces réelles extraites en 1,6s ; gestion des variantes et SKU IDs validée. |
| **05** | **Amazon Renewed Canada** | Reconditionneur pro | got-scraping Tier 1 + Playwright fallback | 🟢 Fonctionnel (Lot 2) | 65 annonces extraites en 1,1s ; URLs canoniques directes `/dp/{asin}` ; prix barrés et rabais calculés. |
| **06** | **Best Buy Canada** | Grand distributeur | Marketplace API JSON v2 | 🟢 Fonctionnel (Lot 2) | 24 annonces extraites en 0,8s ; comparaison regularPrice/salePrice ; condition reconditionnée validée. |
| **07** | **Newegg Canada** | Matériel informatique | JSON SSR `__initialState__` + Cheerio | 🟢 Fonctionnel (Lot 2) | 36 annonces en 220ms via état React SSR ; filtres grades A/B et statuts reconditionné/boîte ouverte. |
| **08** | **Refurb.io Canada** | Spécialiste reconditionné | API Instantanée Shopify JSON | 🟢 Fonctionnel (Lot 2) | 10 annonces en 300ms via `suggest.json` ; parsing prix promotionnels et comparables de gamme. |
| **09** | **Walmart Canada (Refurbished)** | Grand distributeur | Playwright Stealth / Next.js `__NEXT_DATA__` | 🟢 Fonctionnel (Lot 3) | 20 annonces en ~4s via extraction `__NEXT_DATA__` ; détection des rabais et prix actuels. |
| **10** | **IT Refurbs Canada** | Spécialiste reconditionné | API Instantanée Shopify JSON | 🟢 Fonctionnel (Lot 3) | 10 annonces en ~350ms via API `suggest.json` ; parsing grades A/B et prix promotionnels. |
| **11** | **Canada Computers (Open Box)** | Spécialiste canadien | Stealth got-scraping Tier 1 + Cheerio | 🟢 Fonctionnel (Lot 3) | 4+ annonces en ~2,2s ; ciblage des produits remis à neuf et boîtes ouvertes. |
| **12** | **Dell Refurbished Canada** | Constructeur certifié | Stealth got-scraping Tier 1 + Playwright fallback | 🟢 Fonctionnel (Lot 3) | Recherche dynamique `/index.php?page=seek` en ~1,7s ; extraction grades A/B et prix rabais. |
| **13** | **GCSurplus (Lots fédéraux)** | Enchères gouvernementales | Authentification session + POST public + CKAN | 🟢 Fonctionnel (Lot 4) | Recherche publique POST & enchères actives en ~4,5s ; calcul automatique du prix unitaire des lots. |
| **14** | **SEAO (Appels d'offres QC)** | Marché public provincial | Portail `seao.gouv.qc.ca` + Données Québec API | 🟢 Fonctionnel (Lot 4) | Migration de l'ancien domaine vers `seao.gouv.qc.ca` ; repli gracieux sans blocage en ~150ms. |
| **15** | **Insertech Interne (Stock actuel)** | Interne Insertech | Fichier Excel local / Insertech prices JSON | 🟢 Fonctionnel (Lot 4) | Lecture instantanée en ~1ms ; gestion gracieuse en l'absence de classeur atelier. |
| **16** | **Insertech Archives Historiques** | Interne Insertech | Fichiers historiques / SQLite / db.json | 🟢 Fonctionnel (Lot 4) | Balayage des archives et de l'historique en ~1ms sans blocage. |

---

## 3. Phase 2 : Refactorisation Modulaire de l'Architecture

### 3.1 Découpage de `server.ts` (~2500 lignes)
Actuellement, `server.ts` cumule la gestion Express, l'accès SQLite, la logique d'export/import Excel, l'orchestration des tâches en mémoire et les définitions de modèles.

**Nouvelle architecture cible :**
```
server/
├── index.ts                 # Point d'entrée serveur Express & configuration HTTP/sécurité
├── config/                  # Constantes, ports, chemins d'accès, variables d'environnement
├── database/
│   ├── connection.ts        # Connexion SQLite avec DatabaseSync (WAL mode)
│   ├── repository.ts        # Opérations CRUD typées (evaluations, customModels, logs)
│   └── migrations.ts        # Migrations de schéma automatisées
├── services/
│   ├── excel.service.ts     # Génération du classeur 8 feuilles & validation à l'import
│   ├── scraper.service.ts   # Gestion de la file d'attente (activeJobs) et concurrence
│   ├── healing.service.ts   # Auto-réparation et registre de secours Gist
│   └── audit.service.ts     # Journalisation légale et historiques d'actions
├── routes/
│   ├── scraping.routes.ts   # /api/scrape, /api/scrape/status, /api/scrape/stream
│   ├── models.routes.ts     # /api/models/add, /api/models/custom, /api/models/purge
│   ├── excel.routes.ts      # /api/export-excel, /api/import-excel
│   └── system.routes.ts     # /api/system-info, /api/credentials, /api/cache
└── middlewares/
    ├── errorHandler.ts      # Traitement centralisé des erreurs avec codes HTTP stricts
    └── validation.ts        # Validation des schémas d'entrées (modèle, catégorie, usager)
```

### 3.2 Découpage du composant `ModelDetail.tsx` (~1300 lignes)
`ModelDetail.tsx` regroupe l'en-tête, les calculs statistiques, le tableau de comparables, les graphiques et le journal en direct.

**Décomposition ciblée :**
- `ModelDetailHeader.tsx` : Affichage de la catégorie, nom commercial, specs matérielles (RAM, SSD, CPU) et bouton de rafraîchissement.
- `StatisticalSummaryCard.tsx` : Médiane calculée, fourchette IQR, niveau de confiance (Faible/Moyen/Élevé) et état de validation.
- `ListingTable.tsx` : Table interactive des comparables avec tri, filtres de sources et cases d'inclusion/exclusion immédiate.
- `ScrapingProgressMonitor.tsx` : Barres de progression individuelles par scraper et affichage des logs de collecte en direct.
- `PriceHistoryGraph.tsx` : Visualisation de l'évolution du prix médian dans le temps.

---

## 4. Phase 3 : Sécurité des Dépendances & Migration SheetJS

### 4.1 Audit de Sécurité `npm audit`
- Actuellement, 17 vulnérabilités sont signalées dans le projet (notamment au niveau du parsing de fichiers et d'anciennes sous-dépendances).
- **Plan d'action :**
  1. Résoudre les dépendances directes via `npm audit fix --force` sur les packages sans breaking change.
  2. Mettre à niveau les bibliothèques de packaging et compression (`adm-zip`, `cheerio`, `winston`).

### 4.2 Remplacement ou Mise à niveau de `xlsx` (SheetJS)
- Le package actuel `xlsx@0.18.5` n'est plus maintenu sur npm public et présente des alertes de sécurité d'exposition de prototype.
- **Solution recommandée :**
  - **Option A : Migration vers `exceljs`**
    - Package 100% moderne, activement maintenu, support complet de TypeScript.
    - Gestion native des styles (couleurs, polices, bordures, formats monétaires CAD `$ #,##0.00`).
    - Évite tout avertissement de sécurité.
  - **Option B : Migration vers le registre officiel SheetJS (`@sheet/core`)**
    - Conservation de la syntaxe existante si l'équipe souhaite minimiser le volume de réécriture immédiate.

---

## 5. Phase 4 : Optimisation pour Matériel Modeste et Stabilité Windows

1. **Régulation dynamique de la concurrence CPU :**
   - L'application propose déjà un sélecteur de concurrence (1, 2, 4 sources en parallèle).
   - Détection automatique au démarrage : si la machine dispose de 4 threads ou moins, basculer par défaut sur une concurrence de 1 ou 2 sources pour préserver la réactivité du système d'exploitation.
2. **Émulateur Playwright Stealth résilient :**
   - Mise en place d'un timeout de lancement de 25s pour éviter les blocages de verrous sur le profil Chromium sous Windows (`data/puppeteer_profile`).
   - Nettoyage automatique des processus Chromium orphelins lors de la fermeture du serveur Express.
3. **Persistance atomique SQLite :**
   - Utilisation du mode journalier WAL (`PRAGMA journal_mode = WAL;`) pour garantir que les écritures de statut de scraping et les ajouts de modèles ne bloquent pas les lectures concurrentes.

---

## 6. Jalons de Validation et Calendrier de Réalisation

```mermaid
flowchart TD
    M1["Jalon 1 (Terminé) : Correction recherche infinie + Garantie non-perte modèles"]
    M2["Jalon 2 : Audit & Révision des 16 scrapers (Lot 1 : eBay, BackMarket, Reebelo, Amazon)"]
    M3["Jalon 3 : Audit & Révision des 16 scrapers (Lot 2 : BestBuy, Newegg, Refurb.io, Walmart, IT Refurbs)"]
    M4["Jalon 4 : Audit & Révision des 16 scrapers (Lot 3 : Canada Computers, Dell, GCSurplus, SEAO, Insertech)"]
    M5["Jalon 5 : Modularisation de server.ts et ModelDetail.tsx"]
    M6["Jalon 6 : Migration ExcelJS et résolution finale des vulnérabilités npm"]

    M1 --> M2 --> M3 --> M4 --> M5 --> M6
```

### Critères d'acceptation pour chaque jalon :
- [x] **Jalon 1 (Complet) :**
  - Le serveur ne redémarre plus lors de l'ajout d'un modèle (fin du rechargement intempestif de Vite).
  - La recherche ne boucle plus indéfiniment.
  - Tout modèle ajouté manuellement est exporté dans Excel et restauré avec sa catégorie exacte à l'import.
  - 30 tests unitaires Vitest au vert, validation `tsc --noEmit` sans erreur.
- [x] **Jalons 2 à 4 (Complets) :**
  - Les 16 scrapers ont été audités individuellement, fiabilisés, testés avec succès et vérifiés en orchestration de bout en bout en moins de 10 secondes.
  - Résilience garantie pour les ordinateurs plus faibles (Playwright sans conflit de verrous Windows, got-scraping ultra-rapide sur APIs/SSR, cascades propres sans freeze vers les Tiers 2/3).
- [ ] **Jalon 5 :**
  - `server.ts` décomposé en modules de moins de 300 lignes chacun.
  - Tests unitaires et d'API de bout en bout maintenus.
- [ ] **Jalon 6 :**
  - `npm audit` retourne 0 vulnérabilité.
  - Export et import Excel 100% fidèles au modèle réglementaire d'Insertech.
