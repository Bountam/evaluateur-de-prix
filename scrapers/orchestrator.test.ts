import { describe, it, expect } from 'vitest';
import { calculateMedian, flagOutliers } from './orchestrator';

describe('orchestrator', () => {
  describe('calculateMedian', () => {
    it('should calculate the median of an odd length array', () => {
      const items = [{ price: 1, included: true }, { price: 5, included: true }, { price: 3, included: true }, { price: 4, included: true }, { price: 2, included: true }] as any;
      expect(calculateMedian(items)).toBe(3);
    });

    it('should calculate the median of an even length array', () => {
      const items = [{ price: 1, included: true }, { price: 2, included: true }, { price: 3, included: true }, { price: 4, included: true }] as any;
      expect(calculateMedian(items)).toBe(2.5);
    });

    it('should return 0 for an empty array', () => {
      expect(calculateMedian([])).toBe(0);
    });

    it('should calculate the median for an array with one element', () => {
      const items = [{ price: 5, included: true }] as any;
      expect(calculateMedian(items)).toBe(5);
    });
  });

  describe('flagOutliers', () => {
    it('should flag listings outside of the 0.5 to 1.5 range of the median', () => {
      const listings = [
        { title: 'laptop a', price: 100, url: 'a' },
        { title: 'laptop b', price: 110, url: 'b' },
        { title: 'laptop c', price: 90, url: 'c' },
        { title: 'laptop d', price: 300, url: 'd' }, // Outlier (300 > 1.5 * IQR upper bound)
        { title: 'laptop e', price: 10, url: 'e' },  // Outlier (10 < 15 or IQR lower bound)
        { title: 'laptop f', price: 105, url: 'f' }
      ] as any;
      const flagged = flagOutliers(listings);
      
      // Since it's using IQR, Q1=90, Q3=110, IQR=20
      // Lower bound = max(15, 90 - 30) = 60
      // Upper bound = 110 + 30 = 140
      
      expect(flagged.find((l: any) => l.url === 'a')?.included).not.toBe(false);
      expect(flagged.find((l: any) => l.url === 'b')?.included).not.toBe(false);
      expect(flagged.find((l: any) => l.url === 'c')?.included).not.toBe(false);
      expect(flagged.find((l: any) => l.url === 'd')?.included).toBe(false);
      expect(flagged.find((l: any) => l.url === 'e')?.included).toBe(false);
    });
  });
});
