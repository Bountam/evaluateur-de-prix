// ─── Module de taux de change dynamique — Insertech ───────────────────────────
// Utilise l'API publique open.er-api.com (gratuite, sans clé API)
// Taux mis en cache 4 heures en mémoire pour éviter les appels excessifs
// Supporte toutes les devises (USD, GBP, EUR, AUD, etc.) vers CAD

interface RateCache {
  rates: Record<string, number>; // taux vs CAD (ex: { USD: 1.3756, GBP: 1.7231 })
  fetchedAt: number;             // timestamp ms
}

// Cache en mémoire (partagé pour toute la session serveur)
let rateCache: RateCache | null = null;
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 heures

// Taux de repli en cas d'échec de l'API (mis à jour manuellement si nécessaire)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.37,
  GBP: 1.73,
  EUR: 1.49,
  AUD: 0.89,
  NZD: 0.82,
  CHF: 1.53,
  JPY: 0.0092,
  CNY: 0.19,
  HKD: 0.176,
  MXN: 0.071,
};

/**
 * Récupère les taux de change dynamiques depuis open.er-api.com.
 * Base : CAD (les taux retournés sont X devises → CAD).
 * En cas d'échec, utilise les taux de repli statiques.
 */
async function fetchRates(): Promise<Record<string, number>> {
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/CAD', {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      console.warn(`[exchange-rate] API répondue avec HTTP ${resp.status} — taux de repli utilisés`);
      return buildCadRates(FALLBACK_RATES);
    }

    const json = await resp.json() as { result?: string; rates?: Record<string, number> };

    if (json.result !== 'success' || !json.rates) {
      console.warn('[exchange-rate] Réponse inattendue de l\'API — taux de repli utilisés');
      return buildCadRates(FALLBACK_RATES);
    }

    // json.rates est { USD: 0.7281, GBP: 0.5796, ... } (combien de X pour 1 CAD)
    // On veut l'inverse : combien de CAD pour 1 X → cadRates[X] = 1 / rates[X]
    const cadRates: Record<string, number> = {};
    for (const [currency, ratePerCad] of Object.entries(json.rates)) {
      if (typeof ratePerCad === 'number' && ratePerCad > 0) {
        cadRates[currency] = Math.round((1 / ratePerCad) * 100000) / 100000;
      }
    }

    // Toujours inclure CAD = 1 par définition
    cadRates['CAD'] = 1;

    console.log(`[exchange-rate] ✅ Taux récupérés (${Object.keys(cadRates).length} devises) — USD: ${cadRates['USD']?.toFixed(4)} CAD`);
    return cadRates;
  } catch (err) {
    console.warn(`[exchange-rate] Échec de la récupération des taux : ${err instanceof Error ? err.message : String(err)} — taux de repli utilisés`);
    return buildCadRates(FALLBACK_RATES);
  }
}

/**
 * Convertit les taux de repli FALLBACK_RATES (X→CAD) au même format que l'API.
 */
function buildCadRates(fallback: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { CAD: 1 };
  for (const [cur, rate] of Object.entries(fallback)) {
    result[cur] = rate;
  }
  return result;
}

/**
 * Retourne les taux de change vers CAD (avec cache 4h).
 * Appel sûr — retourne toujours un résultat (fallback en cas d'échec API).
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (rateCache && (now - rateCache.fetchedAt) < CACHE_DURATION_MS) {
    return rateCache.rates;
  }

  const rates = await fetchRates();
  rateCache = { rates, fetchedAt: now };
  return rates;
}

/**
 * Convertit un montant d'une devise vers CAD.
 * @param amount  Montant dans la devise source
 * @param from    Code ISO de la devise source (ex: 'USD', 'GBP')
 * @returns       { cadAmount, rate } — montant en CAD et taux utilisé
 */
export async function convertToCAD(
  amount: number,
  from: string,
): Promise<{ cadAmount: number; rate: number }> {
  if (from === 'CAD') return { cadAmount: amount, rate: 1 };

  const rates = await getExchangeRates();
  const rate = rates[from.toUpperCase()] ?? FALLBACK_RATES[from.toUpperCase()] ?? 1.37;
  const cadAmount = Math.round(amount * rate * 100) / 100;
  return { cadAmount, rate };
}

/**
 * Calcule les champs de rabais à partir de deux prix (original et final, en CAD).
 * @returns { discountAmount, discountPercent } ou undefined si aucun rabais significatif
 */
export function computeDiscount(
  originalPrice: number,
  finalPrice: number,
): { discountAmount: number; discountPercent: number } | undefined {
  if (!originalPrice || !finalPrice || originalPrice <= finalPrice) return undefined;
  const discountAmount = Math.round((originalPrice - finalPrice) * 100) / 100;
  const discountPercent = Math.round((discountAmount / originalPrice) * 1000) / 10; // 1 décimale
  if (discountPercent < 1) return undefined; // Ignorer les mini-rabais cosmétiques
  return { discountAmount, discountPercent };
}
