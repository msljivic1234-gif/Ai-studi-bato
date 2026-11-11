
/**
 * Kanonska generacija klijentskog identifikatora zahteva (clientRequestId).
 * Obezbedjuje idempotenciju komandi bez ad-hoc Math.random().
 */
export function noviZahtevId(prefiks: string = "req"): string {
  const timestamp = Date.now().toString(36);
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").substring(0, 16)
      : Math.floor(Math.random() * 1e16).toString(36).padStart(12, "0");

  return `${prefiks}_${timestamp}_${randomPart}`;
}

/**
 * UUID v4 identifikator zahteva za komande čiji server-side p_request_id je
 * tipa uuid (RU-4B pitanja). Kriptografski RNG kada postoji, inače
 * Math.random — ključ idempotencije traži jedinstvenost, ne tajnost.
 */
export function noviUuidZahtevId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
