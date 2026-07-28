# 📖 Guide de l'Utilisateur — Évaluateur de Prix Insertech

Bienvenue dans le guide d'utilisation de l'**Évaluateur de Prix Insertech**. Ce logiciel vous permet d'évaluer rapidement et automatiquement la juste valeur marchande des équipements informatiques d'occasion (portables, desktops, iPhone) à partir des prix du marché secondaire canadien en temps réel.

---

## 🚀 1. Lancement de l'Application

Ouvrez votre navigateur et accédez à l'adresse fournie par votre administrateur :
```
http://localhost:3000
```

L'application bascule automatiquement entre le thème **Clair** et **Sombre** selon vos préférences — vous pouvez aussi le changer manuellement via le bouton ☀️/🌙 en haut à droite.

---

## 🗺️ 2. Structure de l'Interface

### Barre de navigation supérieure
Six onglets principaux :

| Onglet | Contenu |
|---|---|
| **📋 Synthèse** | Tableau de bord global : statistiques par catégorie, alertes de marge, dernières analyses |
| **💻 Portables** | Lenovo ThinkPad, Dell Latitude/XPS, HP EliteBook/ProBook, MacBook |
| **🖥️ Bureau** | Lenovo ThinkCentre, Dell OptiPlex, HP EliteDesk/ProDesk |
| **📱 iPhone** | iPhone 11 → iPhone 15 Pro Max |
| **📡 Sources** | Statut des 16 connecteurs de données du marché secondaire |
| **🏛️ GCSurplus** | Lots gouvernementaux actifs (enchères publiques canadiennes) |

### Barre de navigation secondaire (icônes)
En haut à droite de la fenêtre :
- 📜 **Historique** — Journal d'audit de toutes les modifications
- 📈 **Écarts** — Analyse des variations de prix entre analyses
- 📤 **Export** — Génération du rapport Excel
- ⚙️ **Config** — Paramètres de l'application

### Sidebar gauche
Liste de tous les modèles disponibles dans la catégorie sélectionnée, avec une barre de recherche et un bouton **+ Ajouter un modèle** pour les équipements personnalisés.

---

## 🔍 3. Évaluer un Modèle

1. Choisissez l'onglet de catégorie (**Portables**, **Bureau** ou **iPhone**).
2. Cliquez sur le modèle souhaité dans la liste de gauche (ex: **ThinkPad T490**).
3. Cliquez sur le bouton **`⚡ COLLECTE MULTI-SOURCES`** en haut à droite de la fiche.

Le système lance immédiatement une collecte parallèle sur les **16 sources de données** configurées.

---

## 📡 4. Suivi en Temps Réel

Une fois la collecte lancée :

- **Barres de progression individuelles :** Chaque source affiche son avancement (eBay, Back Market, Reebelo, etc.)
- **Journal de diagnostic :** Cliquez sur la carte d'une source pour voir ses logs détaillés (tentatives, méthode utilisée, nombre d'annonces trouvées)
- **Statut des méthodes :** Les logs indiquent quelle stratégie a été utilisée :
  - *Tier 1* — Scraping direct
  - *Tier 2* — Flux RSS ou API alternative
  - *Tier 3 (Cache)* — Données locales en cache (marquées *isSimulated*)

---

## 📊 5. Interpréter les Résultats

Une fois la collecte terminée, la fiche du modèle affiche :

### Indicateurs principaux
| Indicateur | Signification |
|---|---|
| **Prix médian recommandé (CAD)** | Valeur marchande calculée, après exclusion des outliers et des pièces détachées |
| **Comparables validés** | Nombre d'annonces retenues pour le calcul de la médiane |
| **Indice de confiance** | Fiabilité de l'évaluation selon le volume et la diversité des sources |
| **Historique (sparkline)** | Évolution du prix médian au fil des analyses précédentes |

### Indice de confiance
| Couleur | Signification |
|---|---|
| 🟢 **Élevé** | ≥ 10 comparables valides provenant d'au moins 4 sources |
| 🟡 **Moyen** | ≥ 5 comparables provenant d'au moins 2 sources |
| 🔴 **Faible** | Peu de comparables — à utiliser avec précaution |
| ⚪ **Aucun** | Aucune collecte effectuée pour ce modèle |

---

## ✍️ 6. Validation Humaine & Ajustements

### A. Exclure / Réintégrer un comparable
En bas de la fiche, la liste complète de toutes les annonces collectées est affichée.

- **Double-cliquez** sur une ligne pour l'**exclure** (elle passe en rouge barré, marquée *Outlier*).
- Le prix médian **se recalcule instantanément**.
- Double-cliquez à nouveau pour **réintégrer** le comparable.

### B. Modifier les métadonnées du modèle
Dans l'encadré de résumé en haut de la fiche, double-cliquez sur :
- **Prix recommandé** — pour saisir une valeur manuelle
- **Configuration** — pour préciser les specs (ex: *Intel Core i5, 16 Go, 256 Go SSD*)
- **Condition** — état de l'équipement (Excellent, Très bon, Bon…)
- **Commentaires** — notes libres pour l'équipe d'approvisionnement

Chaque modification est sauvegardée automatiquement et crée une entrée dans le journal **Historique**.

---

## ➕ 7. Ajouter un Modèle Personnalisé

Si un équipement ne figure pas dans la liste prédéfinie :

1. Cliquez sur **`+ Ajouter un modèle`** dans la sidebar gauche.
2. Saisissez le nom du modèle et choisissez sa catégorie.
3. Le modèle est ajouté à la liste et peut être évalué immédiatement.

---

## 🏛️ 8. Onglet GCSurplus

Cet onglet affiche les **lots d'équipements gouvernementaux** actuellement aux enchères sur GCSurplus.ca, avec pour chaque lot :
- Numéro de lot, description, date de clôture
- Offre actuelle et prix unitaire calculé
- Localisation physique du lot
- Statut d'autorisation Insertech

---

## 💾 9. Exportation Excel

Pour générer un rapport d'inventaire complet :

1. Cliquez sur l'icône **📤** dans la barre supérieure droite.
2. Vérifiez le chemin de destination (dossier réseau `I:\...`) ou laissez la valeur par défaut.
3. Cliquez sur **`Générer le rapport Excel (.xlsx)`**.

Le classeur généré contient **8 feuilles** :

| # | Feuille | Contenu |
|---|---|---|
| 1 | **Synthèse** | Indicateurs globaux du marché |
| 2 | **Ordinateurs portables** | Lenovo, Dell, HP, MacBook |
| 3 | **Ordinateurs de bureau** | ThinkCentre, OptiPlex, EliteDesk |
| 4 | **iPhone** | iPhone 11 → 15 Pro Max |
| 5 | **GCSurplus** | Lots d'enchères gouvernementaux |
| 6 | **Sources** | Statut des 16 connecteurs |
| 7 | **Historique** | Journal d'audit comptable complet |
| 8 | **Écarts de prix** | Variations vs analyse précédente |

Un lien de **téléchargement direct** est proposé après génération.

---

## 📜 10. Onglet Historique

Registre d'audit complet de toutes les actions effectuées :
- Collectes multi-sources (déclenchées manuellement)
- Exclusions/réintégrations de comparables
- Modifications de prix, configuration ou condition
- Chaque entrée indique la date, le modèle, l'action, l'ancien prix, le nouveau prix et l'opérateur

---

## 📈 11. Onglet Écarts

Tableau comparatif montrant, pour chaque modèle :
- Prix médian de l'analyse précédente vs prix actuel
- Écart absolu (CAD) et relatif (%)
- Tendance : ▲ Hausse / ▼ Baisse / ● Stable

Utile pour identifier rapidement les modèles dont la valeur marchande évolue significativement.

---

## ❓ Dépannage rapide

| Problème | Solution |
|---|---|
| Une source affiche « Erreur » | Normal si le site est temporairement indisponible — le Tier 3 (cache) prend le relais |
| Prix médian à 0 $ | Aucun comparable valide trouvé — relancer la collecte ou vérifier les filtres |
| Modèle introuvable dans la liste | Utilisez **+ Ajouter un modèle** pour l'enregistrer manuellement |
| L'application ne répond pas | Vérifiez que le serveur backend est bien démarré sur `http://localhost:3000` |
