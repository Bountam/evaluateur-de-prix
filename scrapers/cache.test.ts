import { describe, it, expect, beforeEach } from 'vitest';
import { saveToCache, loadFromCache, clearAllCache, clearCacheForModel, clearCacheForSource, DEFAULT_TTL_MS } from './cache.ts';
import { randomHex, isOutlierTitle, getTier3Cache, saveTier3Cache } from './shared.ts';

describe('System de cache segmenté Tier 3', () => {
  const TEST_SOURCE = 'test-source';
  const TEST_MODEL = 'ThinkPad T480 Test';

  const mockListings = [
    {
      id: 'test-1',
      title: 'Lenovo ThinkPad T480 i5 8GB 256GB SSD',
      price: 350,
      source: 'eBay',
      sourceKey: 'ebay-active',
      date: '2026-09-14',
      url: 'https://www.ebay.ca/sch/i.html?_nkw=T480',
      included: true,
      isOutlier: false,
      isSimulated: false,
    }
  ];

  beforeEach(() => {
    clearAllCache();
  });

  it('devrait enregistrer et charger depuis le cache', () => {
    saveToCache(TEST_SOURCE, TEST_MODEL, mockListings);
    const loaded = loadFromCache(TEST_SOURCE, TEST_MODEL);
    expect(loaded).not.toBeNull();
    expect(loaded?.length).toBe(1);
    expect(loaded?.[0].id).toBe('test-1');
    expect(loaded?.[0].isSimulated).toBe(true);
  });

  it('devrait expirer les entrées plus anciennes que le TTL', () => {
    saveToCache(TEST_SOURCE, TEST_MODEL, mockListings);
    // Charger avec un TTL de -1ms pour simuler l'expiration immédiate
    const expired = loadFromCache(TEST_SOURCE, TEST_MODEL, -1);
    expect(expired).toBeNull();
  });

  it('devrait purger sélectivement par modèle', () => {
    saveToCache(TEST_SOURCE, TEST_MODEL, mockListings);
    clearCacheForModel(TEST_MODEL);
    const loaded = loadFromCache(TEST_SOURCE, TEST_MODEL);
    expect(loaded).toBeNull();
  });

  it('devrait purger sélectivement par source', () => {
    saveToCache(TEST_SOURCE, TEST_MODEL, mockListings);
    clearCacheForSource(TEST_SOURCE);
    const loaded = loadFromCache(TEST_SOURCE, TEST_MODEL);
    expect(loaded).toBeNull();
  });
});

describe('Module partagé scrapers/shared.ts', () => {
  it('devrait générer un hexadécimal de la longueur demandée', () => {
    const hex = randomHex(8);
    expect(hex.length).toBe(8);
    expect(/^[0-9a-f]{8}$/.test(hex)).toBe(true);
  });

  it('devrait détecter les titres aberrants (pièces détachées, boîtes vides)', () => {
    expect(isOutlierTitle('ThinkPad T480 pour pièces ou réparation')).toBe(true);
    expect(isOutlierTitle('Boîte seulement Lenovo ThinkPad')).toBe(true);
    expect(isOutlierTitle('Lenovo ThinkPad T480 16GB RAM 512GB SSD')).toBe(false);
  });
});
