// ─── Gestionnaire de Crédentiels et Identifiants Multi-Sources ───
// Permet d'unifier la lecture des clés d'API et identifiants depuis process.env et db.json (interface utilisateur)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(PROJECT_ROOT, 'db.json');

export interface CredentialsConfig {
  GCSURPLUS_USERNAME?: string;
  GCSURPLUS_PASSWORD?: string;
  INSERTECH_DATA_PATH?: string;
  INSERTECH_ARCHIVES_PATH?: string;
  EBAY_APP_ID?: string;
  EBAY_CERT_ID?: string;
  BESTBUY_API_KEY?: string;
  [key: string]: string | undefined;
}

export function getCredentials(): CredentialsConfig {
  const creds: CredentialsConfig = {
    GCSURPLUS_USERNAME: process.env.GCSURPLUS_USERNAME || '',
    GCSURPLUS_PASSWORD: process.env.GCSURPLUS_PASSWORD || '',
    INSERTECH_DATA_PATH: process.env.INSERTECH_DATA_PATH || 'data/insertech-prices.xlsx',
    INSERTECH_ARCHIVES_PATH: process.env.INSERTECH_ARCHIVES_PATH || 'data/archives/',
    EBAY_APP_ID: process.env.EBAY_APP_ID || '',
    EBAY_CERT_ID: process.env.EBAY_CERT_ID || '',
    BESTBUY_API_KEY: process.env.BESTBUY_API_KEY || '',
  };

  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const db = JSON.parse(content);
      if (db && db.credentials && typeof db.credentials === 'object') {
        Object.keys(db.credentials).forEach((k) => {
          if (db.credentials[k] && typeof db.credentials[k] === 'string') {
            creds[k] = db.credentials[k];
            // Mettre aussi à jour process.env en mémoire pour cohérence
            process.env[k] = db.credentials[k];
          }
        });
      }
    }
  } catch (err) {
    // Erreur silencieuse en cas de lock ou corruption temporaire du fichier DB
  }

  return creds;
}

export function saveCredentials(newCreds: Partial<CredentialsConfig>): CredentialsConfig {
  let db: any = {};
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
    }
  } catch {
    db = {};
  }

  if (!db.credentials) db.credentials = {};
  
  Object.keys(newCreds).forEach((k) => {
    const val = newCreds[k];
    if (val !== undefined) {
      db.credentials[k] = val;
      process.env[k] = val;
    }
  });

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des credentials dans db.json:', err);
  }

  return getCredentials();
}
