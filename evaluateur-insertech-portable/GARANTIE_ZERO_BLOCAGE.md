# Garantie d'exécution Zéro Blocage (Windows & macOS)

L'application **Évaluateur de Prix Insertech** est conçue pour fonctionner de manière autonome sur les postes de travail de bureau et PC reconditionnés sans nécessiter de droits d'administration ou de certificat de signature payant.

## 🛡️ Pourquoi l'application n'est pas bloquée ?

1. **Aucun avertissement de pare-feu (Windows / macOS Firewall)** :
   - Le serveur web s'exécute par défaut en boucle locale (`127.0.0.1 / localhost`).
   - Le trafic ne sort pas sur le réseau public, ce qui évite d'ouvrir des requêtes de privilèges administrateur auprès du pare-feu.

2. **Aucun blocage SmartScreen / Éditeur Inconnu** :
   - L'application utilise les interpréteurs natifs du système (`cmd.exe`, `wscript.exe`, `bash`) qui sont pré-vérifiés et signés directement par Microsoft et Apple.

3. **Compatibilité réseau entreprise** :
   - Aucune installation de pilote ou de service système n'est requise.

## 🚀 Méthodes de lancement :

- **Windows** : Double-cliquer sur `Lancer-Insertech.bat` ou `Lancer-Insertech-Silencieux.vbs`
- **macOS** : Double-cliquer sur `Démarrer-Insertech-macOS.command`
