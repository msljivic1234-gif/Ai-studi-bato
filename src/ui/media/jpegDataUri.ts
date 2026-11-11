/** Bounded in-memory representation of JPEG bytes; no signed URL, file copy or persistent image cache. */
export function jpegDataUri(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = []; let part = '';
  for (let i = 0; i < data.length; i += 3) {
    const word = (data[i] << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    part += alphabet[(word >>> 18) & 63] + alphabet[(word >>> 12) & 63]
      + (i + 1 < data.length ? alphabet[(word >>> 6) & 63] : '=') + (i + 2 < data.length ? alphabet[word & 63] : '=');
    if (part.length >= 16384) { chunks.push(part); part = ''; }
  }
  chunks.push(part); return 'data:image/jpeg;base64,' + chunks.join('');
}
