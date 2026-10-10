import { describe, it, expect } from "vitest";
import {
  getAnomalyReason,
  getScreenSize,
  getOs,
  hasWarranty,
  isLotItem,
  calculateStandardDeviation,
  filterAndSortListings,
  parseSourcesProgress,
  SOURCES_LIST,
  cleanLogSource,
  getStatusColorClass,
  getStatusLabel,
} from "../src/components/model-detail/utils";
import { ComparableListing } from "../src/types";
import { ListingFilters } from "../src/components/model-detail/types";

const createListing = (partial: Partial<ComparableListing> = {}): ComparableListing => ({
  id: partial.id || "l-default",
  title: partial.title || "Default Laptop",
  price: partial.price ?? 300,
  currency: partial.currency || "CAD",
  source: partial.source || "eBay (Ventes complétées)",
  url: partial.url || "https://example.com",
  date: partial.date || "2026-10-01",
  included: partial.included ?? true,
  isOutlier: partial.isOutlier ?? false,
  ...partial,
});

describe("ModelDetail Utils & Business Logic", () => {
  describe("getAnomalyReason", () => {
    const baseListing = createListing({
      id: "l1",
      title: "Lenovo ThinkPad T480 Intel Core i5 16GB 256GB SSD",
      price: 350,
      currency: "CAD",
      source: "eBay (Ventes complétées)",
      url: "https://example.com/item1",
      date: "2026-10-01",
      included: true,
      isOutlier: false,
    });

    it("detects unpowered / non-functional device", () => {
      const listing = createListing({ ...baseListing, title: "ThinkPad T480 FOR PARTS NO POWER" });
      expect(getAnomalyReason(listing, 350)).toContain("NO POWER");
    });

    it("detects missing components (RAM/SSD/OS)", () => {
      const listing1 = createListing({ ...baseListing, title: "ThinkPad T480 NO RAM NO SSD" });
      expect(getAnomalyReason(listing1, 350)).toContain("Composants essentiels manquants");

      const listing2 = createListing({ ...baseListing, title: "ThinkPad T480 NO OS NO STORAGE" });
      expect(getAnomalyReason(listing2, 350)).toContain("Composants essentiels manquants");
    });

    it("detects missing charger or battery", () => {
      const listing = createListing({ ...baseListing, title: "ThinkPad T480 NO AC ADAPTER NO BATTERY" });
      expect(getAnomalyReason(listing, 350)).toContain("Accessoires de base manquants");
    });

    it("detects Grade D condition", () => {
      const listing = createListing({ ...baseListing, title: "ThinkPad T480 Grade D heavy scratches" });
      expect(getAnomalyReason(listing, 350)).toContain("Grade D");
    });

    it("detects 7th gen CPU mismatch", () => {
      const listing = createListing({ ...baseListing, title: "ThinkPad T480 with 7th gen Core i5" });
      expect(getAnomalyReason(listing, 350)).toContain("7e gén");
    });

    it("detects defect and parts keywords", () => {
      const listing = createListing({ ...baseListing, title: "ThinkPad T480 broken screen pour pieces" });
      expect(getAnomalyReason(listing, 350)).toContain("pièces détachées");
    });

    it("detects accessories instead of full laptop", () => {
      const listing = createListing({ ...baseListing, title: "Original 65W AC Adapter Charger for ThinkPad T480" });
      expect(getAnomalyReason(listing, 350)).toContain("accessoire");
    });

    it("detects extreme price variation (< 40% or > 150% of median)", () => {
      const cheapListing = createListing({ ...baseListing, price: 90 });
      expect(getAnomalyReason(cheapListing, 300)).toContain("Prix anormalement bas");

      const expensiveListing = createListing({ ...baseListing, price: 650 });
      expect(getAnomalyReason(expensiveListing, 300)).toContain("Prix anormalement élevé");
    });

    it("detects IQR outliers and fallback", () => {
      const outlierListing = createListing({ ...baseListing, price: 350, isOutlier: true });
      expect(getAnomalyReason(outlierListing, 350)).toContain("interquartile (IQR)");

      const normalListing = createListing({ ...baseListing, price: 350, isOutlier: false });
      expect(getAnomalyReason(normalListing, 350)).toContain("Écart de prix ou anomalie");
    });
  });

  describe("getScreenSize", () => {
    it("uses specs.screenSize if available", () => {
      const listing = createListing({
        title: "Laptop generic",
        specs: { screenSize: '15.6"' }
      });
      expect(getScreenSize(listing)).toBe('15.6"');
    });

    it("extracts from title regex", () => {
      expect(getScreenSize(createListing({ title: "Lenovo T480 14.0 inch FHD" }))).toBe('14"');
      expect(getScreenSize(createListing({ title: "Dell Precision 15.6 in display" }))).toBe('15.6"');
      expect(getScreenSize(createListing({ title: "MacBook Air 13.3 OLED" }))).toBe('13.3"');
      expect(getScreenSize(createListing({ title: "No size specified" }))).toBe("");
    });
  });

  describe("getOs", () => {
    it("uses specs.os if available", () => {
      const listing = createListing({
        specs: { os: "Windows 11 Pro" }
      });
      expect(getOs(listing)).toBe("Windows 11 Pro");
    });

    it("detects OS from title keywords", () => {
      expect(getOs(createListing({ title: "PC Windows 11 Pro 64-bit" }))).toBe("Windows 11 Pro");
      expect(getOs(createListing({ title: "PC Win 11 Home" }))).toBe("Windows 11 Familial");
      expect(getOs(createListing({ title: "PC Windows 10 Professionnel" }))).toBe("Windows 10 Pro");
      expect(getOs(createListing({ title: "MacBook Pro macOS Sonoma" }))).toBe("macOS");
      expect(getOs(createListing({ title: "Chromebook Chrome OS" }))).toBe("ChromeOS");
      expect(getOs(createListing({ title: "PC No OS FreeDOS" }))).toBe("No OS");
    });
  });

  describe("hasWarranty and isLotItem", () => {
    it("recognizes sources with intrinsic warranty", () => {
      expect(hasWarranty(createListing({ source: "Back Market" }))).toBe(true);
      expect(hasWarranty(createListing({ source: "Amazon Renewed" }))).toBe(true);
      expect(hasWarranty(createListing({ source: "eBay", title: "PC with 1-year warranty" }))).toBe(true);
      expect(hasWarranty(createListing({ source: "Kijiji", title: "PC as is" }))).toBe(false);
    });

    it("detects bulk lot sales", () => {
      expect(isLotItem(createListing({ title: "Lot de 5 portables Dell" }))).toBe(true);
      expect(isLotItem(createListing({ title: "ThinkPad T480 bundle of 3" }))).toBe(true);
      expect(isLotItem(createListing({ title: "Lenovo ThinkPad T480 Unité" }))).toBe(false);
    });
  });

  describe("calculateStandardDeviation", () => {
    it("returns 0 for undefined or empty listings", () => {
      expect(calculateStandardDeviation(undefined)).toBe(0);
      expect(calculateStandardDeviation([])).toBe(0);
    });

    it("returns 5% fallback for 1 active listing", () => {
      const listings: ComparableListing[] = [
        createListing({ id: "1", price: 200, included: true }),
        createListing({ id: "2", price: 300, included: false })
      ];
      expect(calculateStandardDeviation(listings)).toBe(10); // 200 * 0.05
    });

    it("computes accurate standard deviation for active listings", () => {
      const listings: ComparableListing[] = [
        createListing({ id: "1", price: 100, included: true }),
        createListing({ id: "2", price: 200, included: true }),
        createListing({ id: "3", price: 300, included: true })
      ];
      // Mean = 200, variance = ((100-200)^2 + 0 + (300-200)^2) / 3 = 20000 / 3 = 6666.67 => sqrt ~ 81.65
      const sd = calculateStandardDeviation(listings);
      expect(sd).toBeCloseTo(81.65, 1);
    });
  });

  describe("filterAndSortListings", () => {
    const defaultFilters: ListingFilters = {
      ram: "Toutes",
      cpu: "Tous",
      storage: "Tous",
      year: "Toutes",
      source: "Toutes",
      screenSize: "Toutes",
      os: "Tous",
      warranty: "Toutes",
      lot: "Tous",
      specFilter: ""
    };

    const mockListings: ComparableListing[] = [
      createListing({
        id: "1",
        title: "Dell Latitude 5490 Core i5 8GB 256GB SSD 14 inch Windows 10 Pro",
        price: 250,
        currency: "CAD",
        source: "eBay (Ventes complétées)",
        sourceKey: "ebay-completed",
        url: "",
        date: "2026-09-15",
        included: true,
        isOutlier: false,
        specs: { ram: "8GB", cpu: "Intel Core i5-8250U", storage: "256GB", year: "2019" }
      }),
      createListing({
        id: "2",
        title: "Dell Latitude 5490 Core i7 16GB 512GB SSD 14.0 Windows 11 Pro",
        price: 450,
        currency: "CAD",
        source: "Back Market",
        sourceKey: "backmarket",
        url: "",
        date: "2026-10-01",
        included: true,
        isOutlier: false,
        specs: { ram: "16GB", cpu: "Intel Core i7-8650U", storage: "512GB", year: "2021" }
      }),
      createListing({
        id: "3",
        title: "Dell Latitude 5490 Lot de 5 Core i5 8GB 256GB SSD",
        price: 1000,
        currency: "CAD",
        source: "GCSurplus",
        sourceKey: "gcsurplus",
        url: "",
        date: "2026-10-05",
        included: false,
        isOutlier: false,
        specs: { isLot: true }
      })
    ];

    it("filters by RAM", () => {
      const res8 = filterAndSortListings(mockListings, { ...defaultFilters, ram: "8 Go" }, "default", "desc");
      expect(res8.some(l => l.id === "1")).toBe(true);
      expect(res8.some(l => l.id === "2")).toBe(false);

      const res16 = filterAndSortListings(mockListings, { ...defaultFilters, ram: "16 Go" }, "default", "desc");
      expect(res16.some(l => l.id === "2")).toBe(true);
      expect(res16.some(l => l.id === "1")).toBe(false);
    });

    it("filters by CPU", () => {
      const resI7 = filterAndSortListings(mockListings, { ...defaultFilters, cpu: "Core i7" }, "default", "desc");
      expect(resI7.length).toBe(1);
      expect(resI7[0].id).toBe("2");
    });

    it("filters by Storage", () => {
      const res512 = filterAndSortListings(mockListings, { ...defaultFilters, storage: "512 Go" }, "default", "desc");
      expect(res512.length).toBe(1);
      expect(res512[0].id).toBe("2");
    });

    it("filters by Lot vs Unité", () => {
      const resUnit = filterAndSortListings(mockListings, { ...defaultFilters, lot: "Unité" }, "default", "desc");
      expect(resUnit.every(l => l.id !== "3")).toBe(true);

      const resLot = filterAndSortListings(mockListings, { ...defaultFilters, lot: "Lot" }, "default", "desc");
      expect(resLot.length).toBe(1);
      expect(resLot[0].id).toBe("3");
    });

    it("filters by Source", () => {
      const resBackMarket = filterAndSortListings(mockListings, { ...defaultFilters, source: "Back Market" }, "default", "desc");
      expect(resBackMarket.length).toBe(1);
      expect(resBackMarket[0].id).toBe("2");
    });

    it("filters by specFilter keyword", () => {
      const resSearch = filterAndSortListings(mockListings, { ...defaultFilters, specFilter: "512GB" }, "default", "desc");
      expect(resSearch.length).toBe(1);
      expect(resSearch[0].id).toBe("2");
    });

    it("sorts by price asc and desc", () => {
      const sortAsc = filterAndSortListings(mockListings, defaultFilters, "price", "asc");
      expect(sortAsc[0].price).toBe(250);
      expect(sortAsc[sortAsc.length - 1].price).toBe(1000);

      const sortDesc = filterAndSortListings(mockListings, defaultFilters, "price", "desc");
      expect(sortDesc[0].price).toBe(1000);
      expect(sortDesc[sortDesc.length - 1].price).toBe(250);
    });

    it("sorts by date asc and desc", () => {
      const sortDateDesc = filterAndSortListings(mockListings, defaultFilters, "date", "desc");
      expect(sortDateDesc[0].id).toBe("3"); // 2026-10-05

      const sortDateAsc = filterAndSortListings(mockListings, defaultFilters, "date", "asc");
      expect(sortDateAsc[0].id).toBe("1"); // 2026-09-15
    });

    it("default sort puts included first, then highest price", () => {
      const defaultSort = filterAndSortListings(mockListings, defaultFilters, "default", "desc");
      // id 2 (included=true, price 450), id 1 (included=true, price 250), id 3 (included=false, price 1000)
      expect(defaultSort[0].id).toBe("2");
      expect(defaultSort[1].id).toBe("1");
      expect(defaultSort[2].id).toBe("3");
    });
  });

  describe("parseSourcesProgress and log cleaning", () => {
    it("cleans bracketed log source tags", () => {
      expect(cleanLogSource("[ebay-completed] Scraped 15 listings")).toBe("Scraped 15 listings");
    });

    it("parses sources progress correctly", () => {
      const logs = [
        "[ebay-completed] 🚀 Scraping direct en cours...",
        "[ebay-completed] ✔️ 14 comparables extraits avec succès",
        "[amazon-renewed] ❌ Échec de la requête: Timeout 10s",
        "Orchestration générale démarrée"
      ];

      const parsed = parseSourcesProgress(logs, false, 100);
      expect(parsed.length).toBe(SOURCES_LIST.length + 1); // 16 sources + orchestrateur

      const general = parsed.find(p => p.key === "general");
      expect(general?.status).toBe("success");
      expect(general?.logs.length).toBe(1);

      const ebay = parsed.find(p => p.key === "ebay-completed");
      expect(ebay?.status).toBe("success");
      expect(ebay?.listingCount).toBe(14);

      const amazon = parsed.find(p => p.key === "amazon-renewed");
      expect(amazon?.status).toBe("failed");
    });

    it("returns proper status classes and labels", () => {
      const itemRunning = { key: "test", name: "Test", icon: "📦", logs: [], status: "running" as const, progress: 50, listingCount: 0 };
      expect(getStatusColorClass("running")).toContain("text-blue-600");
      expect(getStatusLabel(itemRunning)).toBe("Collecte...");

      const itemSuccess = { key: "test", name: "Test", icon: "📦", logs: [], status: "success" as const, progress: 100, listingCount: 8 };
      expect(getStatusColorClass("success")).toContain("text-emerald-600");
      expect(getStatusLabel(itemSuccess)).toBe("8 comparable(s)");

      const itemFailed = { key: "test", name: "Test", icon: "📦", logs: [], status: "failed" as const, progress: 100, listingCount: 0 };
      expect(getStatusColorClass("failed")).toContain("text-rose-600");
      expect(getStatusLabel(itemFailed)).toBe("Aucun résultat");
    });
  });
});
