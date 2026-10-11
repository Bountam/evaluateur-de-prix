export interface HelpTopic {
  title: string;
  description: string;
  tips?: string;
}

export const HELP_CONTENT = {
  // --- Entête & Barre Supérieure ---
  operatorSwitch: {
    title: "Usager Actif & Traçabilité de Session",
    description: "Identifie l'opérateur actuellement connecté. Chaque modification manuelle de prix, d'exclusion ou de commentaire est automatiquement consignée avec votre nom dans le journal d'audit comptable.",
    tips: "Cliquez ici pour changer d'utilisateur ou clôturer votre session de travail en exportant vos données."
  },
  systemVersion: {
    title: "Version & Mises à Jour Automatiques",
    description: "Affiche le numéro de version de l'application et vérifie la disponibilité de nouvelles versions sur GitHub Releases. Permet la mise à jour autonome en un clic sans perte de données.",
    tips: "L'application s'arrête, se met à jour et se relance automatiquement sans nécessiter de droits administrateur."
  },
  cpuConcurrency: {
    title: "Concurrence CPU & Vitesse de Collecte",
    description: "Définit le nombre de requêtes ou de scrapers exécutés simultanément (1 à 4).",
    tips: "Sur un ordinateur d'atelier standard ou à mémoire limitée, une valeur de 1 ou 2 sources garantit une stabilité maximale."
  },
  excelExport: {
    title: "Export & Import Maître Excel",
    description: "Génère un classeur Excel complet comprenant tous les modèles, les annonces comparables, l'historique des prix, le journal d'audit et la configuration de l'organisation. Permet également d'importer une sauvegarde.",
    tips: "Toutes les formules et mises en forme respectent les standards comptables."
  },
  themeToggle: {
    title: "Thème d'Affichage (Clair / Sombre)",
    description: "Bascule entre le mode clair et le mode sombre haute lisibilité conçu pour réduire la fatigue visuelle lors des sessions d'audit prolongées en atelier.",
    tips: "Le choix du thème est mémorisé automatiquement pour vos prochaines ouvertures."
  },

  // --- Navigation Principale ---
  navPortables: {
    title: "Catégorie : Ordinateurs Portables",
    description: "Accède au catalogue des ordinateurs portables reconditionnés (Lenovo ThinkPad, Dell Latitude, HP EliteBook, Apple MacBook).",
    tips: "Sélectionnez un modèle dans le volet latéral pour consulter ses offres et sa médiane."
  },
  navDesktops: {
    title: "Catégorie : Ordinateurs de Bureau",
    description: "Accède au catalogue des postes fixes professionnels, mini-PC de bureau (Tiny, Micro, Mini) et tours reconditionnées.",
    tips: "Les spécifications et profils d'alimentation sont pris en compte dans l'évaluation."
  },
  navIphones: {
    title: "Catégorie : Smartphones & iPhones",
    description: "Accède à la grille d'évaluation des téléphones intelligents reconditionnés et débloqués tous opérateurs.",
    tips: "Les capacités de stockage (64 Go, 128 Go, 256 Go) influencent directement les cotations."
  },
  navHistorique: {
    title: "Journal d'Audit Réglementaire",
    description: "Historique immuable de toutes les actions manuelles : modifications de prix, inclusions/exclusions d'annonces et changements de statut avec horodatage et nom d'usager.",
    tips: "Essentiel pour justifier les preuves de prix lors des contrôles financiers."
  },
  navEcarts: {
    title: "Analyse des Écarts de Valorisation",
    description: "Compare vos prix internes avec les médianes constatées sur le marché secondaire pour identifier les opportunités d'ajustement tarifaire.",
    tips: "Un écart négatif signale un matériel vendu sous la valeur marchande."
  },
  navGcsurplus: {
    title: "Adjudications Fédérales GCSurplus",
    description: "Surveille les lots de matériel informatique en cours d'enchères sur le portail fédéral canadien GCSurplus.",
    tips: "Le calcul automatique du coût unitaire moyen sert d'indicateur pour vos achats en gros."
  },
  navSources: {
    title: "Gestion des Sources & Marque Blanche",
    description: "Permet de personnaliser l'identité visuelle (nom d'organisation, logo, slogan) et de gérer les chemins d'accès aux fichiers du catalogue interne et archives d'atelier.",
    tips: "Vous pouvez également y réinitialiser le cache temporaire des collectes."
  },

  // --- Volet Latéral & Recherche ---
  modelSearch: {
    title: "Recherche de Modèle",
    description: "Filtre instantanément la liste des modèles disponibles dans la catégorie active selon les caractères saisis.",
    tips: "Tapez par exemple « T480 » ou « 5420 » pour trouver rapidement votre équipement."
  },
  addModelBtn: {
    title: "Ajout d'un Nouveau Modèle",
    description: "Permet d'ajouter à la base de données un modèle informatique personnalisé qui ne figure pas dans la liste préconfigurée.",
    tips: "Le modèle sera automatiquement conservé dans la base SQLite et exporté dans vos classeurs Excel."
  },

  // --- En-tête du Détail de Modèle ---
  scrapeModelBtn: {
    title: "Lancer la Collecte Marché",
    description: "Déclenche l'interrogation en temps réel des places de marché (eBay, Back Market, Refurb.io, etc.) pour extraire les offres récentes et les ventes conclues.",
    tips: "Les données sont filtrées automatiquement contre les faux positifs et les pièces détachées."
  },

  // --- Cartes Statistiques & Indicateurs ---
  statMedianPrice: {
    title: "Prix Médian Recommandé (CAD)",
    description: "Valeur marchande centrale calculée sur les annonces retenues. Contrairement à une moyenne arithmétique, la médiane est robuste et élimine l'impact des annonces trop chères ou sous-évaluées.",
    tips: "Ce montant constitue la référence officielle pour votre tarification en reconditionné."
  },
  statComparablesCount: {
    title: "Comparables Validés",
    description: "Nombre total d'offres du marché retenues pour calibrer la médiane après élimination des doublons et des pièces détachées.",
    tips: "Un volume supérieur à 5 comparables garantit une excellente représentativité statistique."
  },
  statLastScraped: {
    title: "Dernière Ingestion des Données",
    description: "Date et heure de la dernière collecte automatisée réussie pour ce modèle spécifique.",
    tips: "Si la date est ancienne, cliquez sur « Collecter » pour rafraîchir les cotes avec les offres du jour."
  },
  statConfidence: {
    title: "Niveau de Confiance Statistique",
    description: "Évalue la fiabilité du prix recommandé en combinant le nombre d'offres trouvées et l'homogénéité des prix (écart-type).",
    tips: "« Élevé » indique un marché liquide avec des prix cohérents."
  },
  statSparkline: {
    title: "Tendance Chronologique des Prix",
    description: "Visualisation graphique de l'évolution du prix médian de ce modèle au fil des différentes dates de collecte.",
    tips: "Permet d'anticiper la dépréciation naturelle du matériel sur le marché secondaire."
  },

  // --- Métadonnées Comptables & Atelier ---
  metaConfiguration: {
    title: "Configuration Matérielle de Référence",
    description: "Détaille les composants de base pour ce modèle (génération de processeur, quantité de RAM, type et capacité de stockage).",
    tips: "Vous pouvez éditer ce champ pour refléter les spécifications exactes de votre lot."
  },
  metaCondition: {
    title: "Condition & État Cosmétique",
    description: "Définit l'état esthétique et fonctionnel de référence (Très bon état, Reconditionné Grade A, etc.).",
    tips: "Un grade cosmétique standardisé justifie la cohérence du prix auprès des auditeurs."
  },
  metaComments: {
    title: "Commentaires & Justification d'Atelier",
    description: "Zone de notes libres pour préciser des particularités techniques (ex: batterie neuve, clavier rétroéclairé, garantie d'atelier incluse).",
    tips: "Ces notes sont imprimées dans le rapport comptable Excel."
  },

  // --- Filtres de Comparables ---
  filterSource: {
    title: "Filtrage par Source de Données",
    description: "Isole les offres provenant d'une place de marché précise (ex: eBay ventes complétées, Back Market, Dell Refurbished).",
    tips: "Pratique pour comparer les tarifs entre plateformes grand public et grossistes certifiés."
  },
  filterHardware: {
    title: "Filtres Matériels (RAM, CPU, Stockage)",
    description: "Filtre les offres pour ne conserver que celles correspondant exactement aux composants de votre équipement.",
    tips: "Permet de recalculer la médiane sur un sous-ensemble très précis (ex: uniquement 16 Go de RAM)."
  },
  filterKeyword: {
    title: "Recherche Textuelle dans les Annonces",
    description: "Recherche un terme spécifique (ex: « tactile », « i7 », « 512 ») dans le titre de toutes les annonces collectées.",
    tips: "Appuyez sur Entrée pour appliquer le filtre instantanément."
  },

  // --- Tableau des Comparables ---
  colIncluded: {
    title: "Inclusion / Exclusion de la Médiane",
    description: "Cochez pour inclure l'annonce dans le calcul de la médiane. Décochez pour l'écarter (ex: écran brisé non détecté, lot non comparable).",
    tips: "Toute modification manuelle est automatiquement journalisée dans l'audit."
  },
  colSource: {
    title: "Origine de l'Annonce",
    description: "Indique la plateforme où l'offre a été relevée. Cliquez sur le titre pour ouvrir l'annonce originale dans votre navigateur.",
    tips: "Les badges identifient clairement les plateformes certifiées et les catalogues locaux."
  },
  colPrice: {
    title: "Prix Relevé & Ajustement Manuel",
    description: "Montant unitaire converti en dollars canadiens (CAD). Vous pouvez cliquer directement sur le prix pour l'ajuster manuellement.",
    tips: "Si l'annonce originale comportait un rabais, le prix d'origine et le pourcentage sont indiqués."
  },
  colStatus: {
    title: "Statut & Détection d'Anomalie (Outlier)",
    description: "Signale si l'algorithme IQR a détecté un prix anormalement extrême, ou si l'offre est une vente réussie ou en cours.",
    tips: "Les annonces en anomalie sont automatiquement exclues par sécurité statistique."
  },

  // --- Onglet Sources & Marque Blanche ---
  whiteLabelSettings: {
    title: "Image de Marque & Marque Blanche",
    description: "Permet de configurer le nom de votre organisation, un slogan et un logo (fichier image ou lien web) qui apparaîtront sur l'interface et dans les classeurs Excel.",
    tips: "En l'absence de logo personnalisé, un badge vectoriel épuré est utilisé par défaut."
  },
  localCatalogFiles: {
    title: "Fichiers de Données Internes & Atelier",
    description: "Définit les emplacements des fichiers Excel ou CSV contenant vos catalogues de vente internes et historiques d'atelier.",
    tips: "Ces fichiers permettent d'intégrer vos propres données de vente dans les calculs comparatifs."
  },
  purgeCacheBtn: {
    title: "Purge Intégrale du Cache de Collecte",
    description: "Supprime tous les fichiers HTML et JSON temporaires mis en cache lors des précédentes requêtes sur les sites web.",
    tips: "Utile si une plateforme a modifié ses pages ou pour forcer une ré-extraction complète de zéro."
  }
} as const;
