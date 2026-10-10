import { describe, it, expect } from 'vitest';
import { normalizeCategory, MASTER_LIST_MODELS } from '../src/modelsData.ts';

describe('Garantie de non-perte et normalisation des modèles personnalisés', () => {
  describe('normalizeCategory', () => {
    it('gère les valeurs nulles, vides ou non définies sans planter', () => {
      expect(normalizeCategory(null)).toBe('Portables Lenovo');
      expect(normalizeCategory(undefined)).toBe('Portables Lenovo');
      expect(normalizeCategory('')).toBe('Portables Lenovo');
    });

    it('identifie les catégories canoniques exactes', () => {
      expect(normalizeCategory('Portables Lenovo')).toBe('Portables Lenovo');
      expect(normalizeCategory('Portables Dell')).toBe('Portables Dell');
      expect(normalizeCategory('Portables Dell XPS')).toBe('Portables Dell XPS');
      expect(normalizeCategory('Portables HP')).toBe('Portables HP');
      expect(normalizeCategory('Apple')).toBe('Apple');
      expect(normalizeCategory('Desktop Lenovo')).toBe('Desktop Lenovo');
      expect(normalizeCategory('Desktop Dell')).toBe('Desktop Dell');
      expect(normalizeCategory('Desktop HP')).toBe('Desktop HP');
      expect(normalizeCategory('iPhones')).toBe('iPhones');
    });

    it('normalise intelligemment les variations de libellés', () => {
      expect(normalizeCategory('Portables Lenovo (ThinkPad)')).toBe('Portables Lenovo');
      expect(normalizeCategory('Tours de Bureau Lenovo (ThinkCentre)')).toBe('Desktop Lenovo');
      expect(normalizeCategory('Tours de Bureau Dell (OptiPlex)')).toBe('Desktop Dell');
      expect(normalizeCategory('Tours de Bureau HP (EliteDesk, ProDesk)')).toBe('Desktop HP');
      expect(normalizeCategory('Ordinateurs de bureau')).toBe('Desktop Lenovo');
      expect(normalizeCategory('Téléphones Apple iPhone')).toBe('iPhones');
      expect(normalizeCategory('Portables Apple (MacBook Air / Pro)')).toBe('Apple');
      expect(normalizeCategory('Dell Latitude portable')).toBe('Portables Dell');
      expect(normalizeCategory('HP EliteBook portable')).toBe('Portables HP');
    });

    it('préserve une catégorie entièrement personnalisée sans la supprimer', () => {
      expect(normalizeCategory('Tablettes Samsung Galaxy')).toBe('Tablettes Samsung Galaxy');
      expect(normalizeCategory('Moniteurs UltraWide')).toBe('Moniteurs UltraWide');
    });
  });

  describe('Intégrité de la liste maître et détection des doublons', () => {
    it('la liste maître contient toutes les catégories standard nécessaires', () => {
      const catNames = MASTER_LIST_MODELS.map(c => c.categoryName);
      expect(catNames).toContain('Portables Lenovo');
      expect(catNames).toContain('Portables Dell');
      expect(catNames).toContain('Portables Dell XPS');
      expect(catNames).toContain('Portables HP');
      expect(catNames).toContain('Apple');
      expect(catNames).toContain('Desktop Lenovo');
      expect(catNames).toContain('Desktop Dell');
      expect(catNames).toContain('Desktop HP');
      expect(catNames).toContain('iPhones');
    });

    it('fusionne les modèles personnalisés avec les modèles maîtres sans perte', () => {
      const customModels = [
        { category: 'Portables Lenovo (ThinkPad)', modelName: 'ThinkPad T14s Gen 3' },
        { category: 'Desktop Dell', modelName: 'OptiPlex 7090 Micro' },
        { category: 'Moniteurs Professionnels', modelName: 'Dell UltraSharp U2723QE' }
      ];

      const standardCatNames = new Set(MASTER_LIST_MODELS.map(c => c.categoryName));

      // 1. Fusion standard
      const merged = MASTER_LIST_MODELS.map(cat => {
        const customsForCat = customModels
          .filter(cm => normalizeCategory(cm.category) === cat.categoryName)
          .map(cm => cm.modelName);
        return {
          ...cat,
          models: Array.from(new Set([...cat.models, ...customsForCat]))
        };
      });

      // 2. Extra catégories
      const extraCategoriesMap: Record<string, string[]> = {};
      customModels.forEach(cm => {
        const normCat = normalizeCategory(cm.category);
        if (!standardCatNames.has(normCat)) {
          if (!extraCategoriesMap[normCat]) extraCategoriesMap[normCat] = [];
          if (!extraCategoriesMap[normCat].includes(cm.modelName)) {
            extraCategoriesMap[normCat].push(cm.modelName);
          }
        }
      });

      const extraCategories = Object.entries(extraCategoriesMap).map(([categoryName, models]) => ({
        categoryName,
        models
      }));

      const allMerged = [...merged, ...extraCategories];

      // Vérification 1: le modèle ThinkPad T14s Gen 3 est bien dans Portables Lenovo
      const lenovo = allMerged.find(c => c.categoryName === 'Portables Lenovo');
      expect(lenovo?.models).toContain('ThinkPad T14s Gen 3');

      // Vérification 2: le modèle OptiPlex 7090 Micro est bien dans Desktop Dell
      const dellDesktop = allMerged.find(c => c.categoryName === 'Desktop Dell');
      expect(dellDesktop?.models).toContain('OptiPlex 7090 Micro');

      // Vérification 3: la catégorie inconnue Moniteurs Professionnels a été conservée
      const extraCat = allMerged.find(c => c.categoryName === 'Moniteurs Professionnels');
      expect(extraCat).toBeDefined();
      expect(extraCat?.models).toContain('Dell UltraSharp U2723QE');
    });
  });
});
