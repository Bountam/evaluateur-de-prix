import { describe, it, expect } from 'vitest';
import { parseCADPrice, isModelMatch, isPartOrAssembly, extractSpecsFromTitle } from './utils';

describe('utils', () => {
  describe('parseCADPrice', () => {
    it('should parse simple numbers', () => {
      expect(parseCADPrice(123)).toBe(123);
      expect(parseCADPrice('123')).toBe(123);
      expect(parseCADPrice('123.45')).toBe(123.45);
    });

    it('should strip currency symbols and spaces', () => {
      expect(parseCADPrice('$ 1 200,50')).toBe(1200.5);
      expect(parseCADPrice('1200 $')).toBe(1200);
      expect(parseCADPrice('C $1500')).toBe(1500);
      expect(parseCADPrice('CAD 1 500.00')).toBe(1500);
    });

    it('should handle French commas as decimals', () => {
      expect(parseCADPrice('123,45')).toBe(123.45);
      expect(parseCADPrice('1 234,56')).toBe(1234.56);
      expect(parseCADPrice('1.234,56')).toBe(1234.56);
    });

    it('should keep numbers as numbers when parsed directly', () => {
      // 123450 is a number, it will be returned as is (rounded to 2 decimal places).
      expect(parseCADPrice(123450)).toBe(123450);
    });

    it('should handle large string numbers without decimals correctly', () => {
      // parseCADPrice divides by 100 if the value > 5000 (usually because it misses the decimal)
      expect(parseCADPrice('123450')).toBe(1234.5);
    });
    
    it('should return null for invalid inputs', () => {
      expect(parseCADPrice('hello')).toBe(null);
      expect(parseCADPrice('-')).toBe(null);
      expect(parseCADPrice(null)).toBe(null);
      expect(parseCADPrice(undefined)).toBe(null);
    });
  });

  describe('isModelMatch', () => {
    it('should return true for exact matches', () => {
      expect(isModelMatch('OptiPlex 3080', 'OptiPlex 3080')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isModelMatch('optiplex 3080', 'OptiPlex 3080')).toBe(true);
    });

    it('should handle partial matches', () => {
      expect(isModelMatch('Dell OptiPlex 3080 SFF', 'OptiPlex 3080')).toBe(true);
    });
  });

  describe('isPartOrAssembly', () => {
    it('should return true for parts', () => {
      expect(isPartOrAssembly('Dell OptiPlex 3080 Motherboard')).toBe(true);
      expect(isPartOrAssembly('LCD screen pour ThinkPad T14')).toBe(true);
      expect(isPartOrAssembly('pour pièces')).toBe(true);
    });

    it('should return false for full machines', () => {
      expect(isPartOrAssembly('Dell OptiPlex 3080 SFF Intel Core i5')).toBe(false);
      expect(isPartOrAssembly('ThinkPad T14 Gen 2')).toBe(false);
    });
  });

  describe('extractSpecsFromTitle', () => {
    it('should extract CPU, RAM, and Storage', () => {
      const specs = extractSpecsFromTitle('Dell OptiPlex 3080 i5-10500 16GB RAM 512GB SSD');
      expect(specs.cpu).toBe('I5-10500');
      expect(specs.ram).toBe('16 Go');
      expect(specs.storage).toBe('512 Go SSD');
    });

    it('should handle French terms', () => {
      const specs = extractSpecsFromTitle('ThinkPad T14 Intel Core i7-8550U 32 Go 1 To NVMe');
      expect(specs.cpu).toBe('I7-8550U');
      expect(specs.ram).toBe('32 Go');
      expect(specs.storage).toBe('1 To SSD');
    });
  });
});
