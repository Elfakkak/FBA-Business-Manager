// Brand registry — the single home for private-label brand details, kept
// separate from company/business info. The catalog reads the brand name from
// here (instead of a hardcoded constant); Settings → Brand edits it. Persisted
// to localStorage. Logo lives in an <image-slot id="vy-brand-logo"> (its own store).

const BRAND_STORE_KEY = "vy_brand_v1";

const BRAND_DEFAULTS = {
  name: "Manifest",
  tagline: "Premium auto interior, private label.",
  color: "#E8602C",
  established: "2024",
  // Amazon Brand Registry
  registryEnrolled: true,
  registryId: "BR-8841-VYX",
  gtinExempt: true,
  // Trademark
  tmNumber: "US 97/812,445",
  tmStatus: "Registered",
  tmJurisdiction: "USPTO (United States)",
  tmOwner: "Vyonix Commerce LLC",
  // Presence
  website: "vyonix.co",
  storeUrl: "amazon.com/vyonix",
  supportEmail: "support@vyonix.co",
};

function brandLoad() {
  try {
    const raw = localStorage.getItem(BRAND_STORE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...BRAND_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch (e) { return { ...BRAND_DEFAULTS }; }
}
function brandSave(obj) {
  try { localStorage.setItem(BRAND_STORE_KEY, JSON.stringify(obj)); } catch (e) {}
}
function brandName() { return brandLoad().name || "Manifest"; }

Object.assign(window, { BRAND_DEFAULTS, brandLoad, brandSave, brandName });
