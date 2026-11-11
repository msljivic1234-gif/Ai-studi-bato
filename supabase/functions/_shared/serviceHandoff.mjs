// Shared wire validation only. Country syntax is not a shipping promise and a
// city label is not an exact address or an authoritative geographic identifier.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const country = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value);
const utf8Length = text => { let bytes = 0; for (const char of text) { const point = char.codePointAt(0); bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4; } return bytes; };

/** Return a detached, unchanged value or null. Never sort/normalize facts behind
 * a signed review's back. Missing is UNKNOWN, never unrestricted physical delivery.
 */
export function decodeServiceHandoff(value) {
  if (!record(value) || !Object.hasOwn(value, 'required')) return null;
  try { if (utf8Length(JSON.stringify(value)) > 2048) return null; }
  catch { return null; }
  if (value.required === false) return exact(value, ['required']) ? { required: false } : null;
  if (value.required !== true || Object.keys(value).some(key => !['required', 'shippingCountries', 'localExchange'].includes(key))) return null;
  const shipping = Object.hasOwn(value, 'shippingCountries'), local = Object.hasOwn(value, 'localExchange');
  if (!shipping && !local) return null;
  if (shipping && (!Array.isArray(value.shippingCountries) || value.shippingCountries.length < 1 || value.shippingCountries.length > 32
      || !Array.from(value.shippingCountries).every(country) || new Set(value.shippingCountries).size !== value.shippingCountries.length)) return null;
  if (local && (!exact(value.localExchange, ['countryCode', 'city']) || !country(value.localExchange.countryCode)
      || typeof value.localExchange.city !== 'string' || Array.from(value.localExchange.city).length < 3 || Array.from(value.localExchange.city).length > 120
      || value.localExchange.city !== value.localExchange.city.trim() || /[<>\u0000-\u001f\u007f-\u009f]/.test(value.localExchange.city))) return null;
  return { required: true, ...(shipping ? { shippingCountries: value.shippingCountries.slice() } : {}),
    ...(local ? { localExchange: { countryCode: value.localExchange.countryCode, city: value.localExchange.city } } : {}) };
}

/** Shared owner-visible summary; countries retain the reviewed input order. */
export function formatServiceHandoff(value) {
  const handoff = decodeServiceHandoff(value);
  if (!handoff) return null;
  if (!handoff.required) return 'Bez fizičke predaje';
  return [handoff.shippingCountries ? 'Slanje: ' + handoff.shippingCountries.join(', ') : null,
    handoff.localExchange ? `Lično preuzimanje: ${handoff.localExchange.city} (${handoff.localExchange.countryCode})` : null]
    .filter(Boolean).join(' ili ');
}
