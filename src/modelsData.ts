export interface CategoryModels {
  categoryName: string;
  models: string[];
}

export const MASTER_LIST_MODELS: CategoryModels[] = [
  {
    categoryName: "Portables Lenovo",
    models: [
      "ThinkPad T480",
      "ThinkPad T480s",
      "ThinkPad T490",
      "ThinkPad T490s",
      "ThinkPad T14 Gen 1",
      "ThinkPad T14 Gen 2",
      "ThinkPad L480",
      "ThinkPad L490",
      "ThinkPad E480",
      "ThinkPad E490",
      "ThinkPad X390",
      "ThinkPad X13",
      "ThinkPad X1 Carbon Gen 6+",
      "ThinkPad E14 Gen 4"
    ]
  },
  {
    categoryName: "Portables Dell",
    models: [
      "Latitude 5400",
      "Latitude 5410",
      "Latitude 5420",
      "Latitude 5430",
      "Latitude 5490",
      "Latitude 5500",
      "Latitude 5510",
      "Latitude 5520",
      "Latitude 7300",
      "Latitude 7310",
      "Latitude 7400",
      "Latitude 7410",
      "Latitude 7420"
    ]
  },
  {
    categoryName: "Portables Dell XPS",
    models: [
      // ─── XPS 13 (9300 / 9305 / 9310 / 9315 / 9320) ───
      "Dell XPS 13 9300",
      "Dell XPS 13 9305",
      "Dell XPS 13 9310",
      "Dell XPS 13 9315",
      "Dell XPS 13 9320",
      // ─── XPS 13 Plus ───
      "Dell XPS 13 Plus 9320",
      // ─── XPS 15 (9500 / 9510 / 9520 / 9530) ───
      "Dell XPS 15 9500",
      "Dell XPS 15 9510",
      "Dell XPS 15 9520",
      "Dell XPS 15 9530",
      // ─── XPS 17 (9700 / 9710 / 9720 / 9730) ───
      "Dell XPS 17 9700",
      "Dell XPS 17 9710",
      "Dell XPS 17 9720",
      "Dell XPS 17 9730",       // Demandé explicitement
      // ─── Numéro de modèle constructeur (P-series) ───
      "Dell XPS 15 P129F001",   // Demandé explicitement (XPS 15 9500/9510)
      "Dell XPS 13 P117G",      // XPS 13 9300/9310
      "Dell XPS 17 P92F",       // XPS 17 9700/9710
      "Dell XPS 17 P92F001"      // XPS 17 9720/9730
    ]
  },
  {
    categoryName: "Portables HP",
    models: [
      "EliteBook 840 G5",
      "EliteBook 840 G6",
      "EliteBook 840 G7",
      "EliteBook 840 G8",
      "EliteBook 850 G5",
      "EliteBook 850 G6",
      "ProBook 440 G5+",
      "ProBook 450 G5+"
    ]
  },
  {
    categoryName: "Apple",
    models: [
      "MacBook Air Intel 2018+",
      "MacBook Air M1",
      "MacBook Air M2",
      "MacBook Pro Intel 2018+",
      "MacBook Pro M1",
      "MacBook Pro M2"
    ]
  },
  {
    categoryName: "Desktop Lenovo",
    models: [
      "ThinkCentre M720",
      "ThinkCentre M720q",
      "ThinkCentre M920",
      "ThinkCentre M920q",
      "ThinkCentre M70q",
      "ThinkCentre M80q",
      "ThinkCentre M90q"
    ]
  },
  {
    categoryName: "Desktop Dell",
    models: [
      "OptiPlex 3060",
      "OptiPlex 5060",
      "OptiPlex 7060",
      "OptiPlex 3070",
      "OptiPlex 5070",
      "OptiPlex 7070",
      "OptiPlex 3080",
      "OptiPlex 5080",
      "OptiPlex 7080"
    ]
  },
  {
    categoryName: "Desktop HP",
    models: [
      "EliteDesk 800 G4",
      "EliteDesk 800 G5",
      "EliteDesk 800 G6",
      "ProDesk 600 G4",
      "ProDesk 600 G5"
    ]
  },
  {
    categoryName: "iPhones",
    models: [
      "iPhone 11",
      "iPhone 11 Pro",
      "iPhone 11 Pro Max",
      "iPhone SE 2020",
      "iPhone 12",
      "iPhone 12 Mini",
      "iPhone 12 Pro",
      "iPhone 12 Pro Max",
      "iPhone 13",
      "iPhone 13 Mini",
      "iPhone 13 Pro",
      "iPhone 13 Pro Max",
      "iPhone SE 2022",
      "iPhone 14",
      "iPhone 14 Plus",
      "iPhone 14 Pro",
      "iPhone 14 Pro Max",
      "iPhone 15",
      "iPhone 15 Plus",
      "iPhone 15 Pro",
      "iPhone 15 Pro Max"
    ]
  }
];
