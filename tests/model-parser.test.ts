import { describe, it, expect } from "vitest";
import { inferCategoryFromModel, parseModelRawString, searchReferenceModels } from "../src/utils/modelParser";

describe("Smart Model Parser & Inférence Automatique (v1.7.0)", () => {
  describe("1. Inférence de catégorie automatique (inferCategoryFromModel)", () => {
    it("déduit correctement les catégories Lenovo", () => {
      expect(inferCategoryFromModel("ThinkPad T14 Gen 2")).toBe("Portables Lenovo");
      expect(inferCategoryFromModel("T480s")).toBe("Portables Lenovo");
      expect(inferCategoryFromModel("ThinkPad X1 Carbon Gen 9")).toBe("Portables Lenovo");
      expect(inferCategoryFromModel("ThinkCentre M720q")).toBe("Desktop Lenovo");
      expect(inferCategoryFromModel("M70q Gen 3 Tiny")).toBe("Desktop Lenovo");
    });

    it("déduit correctement les catégories Dell", () => {
      expect(inferCategoryFromModel("Latitude 5420")).toBe("Portables Dell");
      expect(inferCategoryFromModel("Dell Latitude 7410")).toBe("Portables Dell");
      expect(inferCategoryFromModel("OptiPlex 7080 Micro")).toBe("Desktop Dell");
      expect(inferCategoryFromModel("OptiPlex 5060 SFF")).toBe("Desktop Dell");
      expect(inferCategoryFromModel("Dell XPS 15 9500")).toBe("Portables Dell XPS");
      expect(inferCategoryFromModel("P129F001")).toBe("Portables Dell XPS");
    });

    it("déduit correctement les catégories HP", () => {
      expect(inferCategoryFromModel("EliteBook 840 G8")).toBe("Portables HP");
      expect(inferCategoryFromModel("ProBook 450 G9")).toBe("Portables HP");
      expect(inferCategoryFromModel("HP EliteDesk 800 G5 Mini")).toBe("Desktop HP");
      expect(inferCategoryFromModel("ProDesk 600 G4")).toBe("Desktop HP");
    });

    it("déduit correctement les catégories Apple", () => {
      expect(inferCategoryFromModel("MacBook Air M1")).toBe("Apple");
      expect(inferCategoryFromModel("MacBook Pro M2 14\"")).toBe("Apple");
      expect(inferCategoryFromModel("Mac mini M2")).toBe("Apple");
      expect(inferCategoryFromModel("iPhone 13 Pro")).toBe("iPhones");
      expect(inferCategoryFromModel("iPhone 14 Plus")).toBe("iPhones");
    });
  });

  describe("2. Décomposition de lignes brutes d'inventaire (parseModelRawString)", () => {
    it("décompose une ligne complète Dell d'atelier", () => {
      const result = parseModelRawString("Dell Latitude 5420 i7-1185G7 16GB 512SSD Win11 Pro");
      expect(result.cleanModelName).toBe("Latitude 5420");
      expect(result.category).toBe("Portables Dell");
      expect(result.brand).toBe("Dell");
      expect(result.formFactor).toBe("portable");
      expect(result.specs.cpu).toBe("Core i7");
      expect(result.specs.ram).toBe("16 Go RAM");
      expect(result.specs.storage).toBe("512 Go SSD");
      expect(result.specs.fullConfiguration).toBe("Core i7, 16 Go RAM, 512 Go SSD");
    });

    it("décompose une ligne ThinkPad avec spécifications en français", () => {
      const result = parseModelRawString("Lenovo ThinkPad T14 Gen 2 Core i5 32 Go RAM 1 To SSD");
      expect(result.cleanModelName).toBe("ThinkPad T14 Gen 2");
      expect(result.category).toBe("Portables Lenovo");
      expect(result.brand).toBe("Lenovo");
      expect(result.specs.cpu).toBe("Core i5");
      expect(result.specs.ram).toBe("32 Go RAM");
      expect(result.specs.storage).toBe("1 To SSD");
      expect(result.specs.fullConfiguration).toBe("Core i5, 32 Go RAM, 1 To SSD");
    });

    it("décompose un Apple MacBook avec Apple Silicon et bruit cosmétique", () => {
      const result = parseModelRawString("MacBook Air M1 2020 8GB 256GB Gris Sidéral Grade A");
      expect(result.cleanModelName).toBe("MacBook Air M1");
      expect(result.category).toBe("Apple");
      expect(result.brand).toBe("Apple");
      expect(result.specs.cpu).toBe("Apple M1");
      expect(result.specs.ram).toBe("8 Go RAM");
      expect(result.specs.storage).toBe("256 Go SSD");
    });

    it("décompose un poste fixe OptiPlex Micro", () => {
      const result = parseModelRawString("Dell OptiPlex 7080 Micro i5-10500T 16GB 512SSD");
      expect(result.cleanModelName).toBe("OptiPlex 7080");
      expect(result.category).toBe("Desktop Dell");
      expect(result.formFactor).toBe("desktop");
      expect(result.specs.ram).toBe("16 Go RAM");
      expect(result.specs.storage).toBe("512 Go SSD");
    });

    it("décompose un iPhone avec capacité de stockage", () => {
      const result = parseModelRawString("iPhone 13 Pro 256 Go Bleu Alpin Débloqué");
      expect(result.cleanModelName).toBe("iPhone 13 Pro");
      expect(result.category).toBe("iPhones");
      expect(result.formFactor).toBe("phone");
      expect(result.specs.storage).toBe("256 Go SSD");
    });

    it("gère gracieusement une entrée vide ou simple sans planter", () => {
      const empty = parseModelRawString("");
      expect(empty.cleanModelName).toBe("");

      const single = parseModelRawString("ThinkPad T480");
      expect(single.cleanModelName).toBe("ThinkPad T480");
      expect(single.category).toBe("Portables Lenovo");
    });
  });

  describe("3. Autocomplétion sur modèles de référence (searchReferenceModels)", () => {
    it("trouve des modèles par numéro partiel", () => {
      const results = searchReferenceModels("542");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name === "Latitude 5420")).toBe(true);
    });

    it("trouve des modèles par mots-clés multiples (ex: 't14 g2')", () => {
      const results = searchReferenceModels("t14 g2");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name === "ThinkPad T14 Gen 2")).toBe(true);
    });

    it("trouve les MacBooks récents avec processeur M", () => {
      const results = searchReferenceModels("air m2");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name === "MacBook Air M2")).toBe(true);
    });

    it("renvoie une liste vide pour une requête trop courte", () => {
      expect(searchReferenceModels("")).toEqual([]);
      expect(searchReferenceModels("a")).toEqual([]);
    });
  });
});
