import * as fs from 'fs';

const DB_PATH = 'db.json';
if (fs.existsSync(DB_PATH)) {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const sources = [
    { name: "eBay (Ventes complétées)", type: "Marché secondaire référence", authorized: true, status: "Actif (Scraper & RSS)", description: "Analyse statistique des transactions finalisées pour déterminer la juste valeur marchande d'échange.", url: "https://www.ebay.ca/", sourceKey: "ebay-completed" },
    { name: "eBay (Annonces actives)", type: "Offre secondaire immédiate", authorized: true, status: "Actif (Scraper & RSS)", description: "Analyse des prix demandés pour mesurer l'état instantané du marché et la concurrence disponible.", url: "https://www.ebay.ca/", sourceKey: "ebay-active" },
    { name: "Back Market", type: "Reconditionné certifié", authorized: true, status: "Actif (Scraper)", description: "Référence d'indice supérieure pour le reconditionné de haut niveau (grade garanti, garantie légale).", url: "https://www.backmarket.ca/", sourceKey: "backmarket" },
    { name: "Reebelo", type: "Plateforme reconditionnée", authorized: true, status: "Actif (Scraper)", description: "Comparateur d'équipements mobiles et d'ordinateurs portables reconditionnés canadiens.", url: "https://www.reebelo.ca/", sourceKey: "reebelo" },
    { name: "Amazon Renewed", type: "Boutique d'occasion certifiée", authorized: true, status: "Actif (Scraper)", description: "Prix de vente publics avec politique de retour standard de 90 jours sur Amazon Canada.", url: "https://www.amazon.ca/gp/browse.html?node=17332215011", sourceKey: "amazon-renewed" },
    { name: "Best Buy Marketplace", type: "Marchands tiers reconditionneurs", authorized: true, status: "Actif (Scraper)", description: "Prix de vente sur la place de marché tierce de Best Buy Canada pour le matériel reconditionné.", url: "https://www.bestbuy.ca/", sourceKey: "bestbuy" },
    { name: "Newegg Canada (Refurbished)", type: "Marché informatique reconditionné", authorized: true, status: "Actif (Scraper)", description: "Portables et ordinateurs de bureau reconditionnés certifiés Grade A sur Newegg Canada.", url: "https://www.newegg.ca/", sourceKey: "newegg" },
    { name: "Refurb.io Canada", type: "Boutique spécialisée reconditionnée", authorized: true, status: "Actif (API & Scraper)", description: "Reconditionneur canadien certifié spécialisé en matériel d'entreprise Dell, HP et Lenovo.", url: "https://refurb.io/", sourceKey: "refurb-io" },
    { name: "Walmart Canada (Restored)", type: "Programme Walmart Restored", authorized: true, status: "Actif (Scraper)", description: "Équipements électroniques reconditionnés avec garantie sur la plateforme Walmart Canada.", url: "https://www.walmart.ca/", sourceKey: "walmart" },
    { name: "Dell Refurbished Canada", type: "Matériel constructeur off-lease", authorized: true, status: "Actif (Scraper)", description: "Boutique officielle Dell de matériel d'entreprise de retour de location (Latitude, OptiPlex, Precision).", url: "https://www.dellrefurbished.ca/", sourceKey: "dell" },
    { name: "IT Refurbs Canada", type: "Boutique informatique reconditionnée", authorized: true, status: "Actif (API & Scraper)", description: "Reconditionneur informatique canadien spécialisé en PC et ordinateurs portables professionnels.", url: "https://itrefurbs.ca/", sourceKey: "it-refurbs" },
    { name: "Canada Computers (Refurbished)", type: "Détaillant informatique spécialisé", authorized: true, status: "Actif (Scraper)", description: "Inventaire d'ordinateurs et portables reconditionnés du détaillant Canada Computers.", url: "https://www.canadacomputers.com/", sourceKey: "canada-computers" },
    { name: "SEAO (Appels d'offres & Lots publics)", type: "Marchés publics Québec", authorized: true, status: "Actif (Scraper)", description: "Système électronique d'appel d'offres du Québec pour les lots et contrats d'équipements informatiques.", url: "https://www.seao.ca/", sourceKey: "seao" },
    { name: "GCSurplus", type: "Enchères gouvernementales", authorized: true, status: "Recherche Publique", description: "Source d'approvisionnement principale d'Insertech. Permet d'acquérir des lots informatiques au volume.", url: "https://www.gcsurplus.ca/", sourceKey: "gcsurplus" },
    { name: "Insertech (Interne)", type: "Historique d'atelier & boutique", authorized: true, status: "Connecté (Fichier Excel/JSON)", description: "Nos propres prix de vente appliqués en boutique solidaire, nos temps de rotation et historiques d'inventaire.", url: "https://www.insertech.ca", sourceKey: "insertech-internal" },
    { name: "Insertech (Archives)", type: "Archives d'analyses historiques", authorized: true, status: "Actif (Scanner d'archives)", description: "Archivage permanent de nos études de marché mensuelles et analyses historiques antérieures pour audit comptable.", url: "#", sourceKey: "insertech-archives" }
  ];
  db.sources = sources;
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`✅ ${sources.length} sources synchronisées avec succès dans db.json !`);
}
