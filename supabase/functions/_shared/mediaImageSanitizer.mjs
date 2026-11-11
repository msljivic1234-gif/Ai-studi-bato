// Trusted server-side JPEG/PNG/WebP decode. No native delegate, URL or filename.
// Runtime is pinned @imagemagick/magick-wasm 0.0.43, injected for real WASM tests.
export const MEDIA_LIMITS = Object.freeze({ inputBytes: 10 * 1024 * 1024, outputBytes: 5 * 1024 * 1024,
  maxEdge: 1600, maxDecodedPixels: 16_000_000, maxDecodedEdge: 16000 });

export function imageCodec(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MEDIA_LIMITS.inputBytes) throw new Error('MEDIA_INPUT_INVALID');
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'JPEG';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'PNG';
  if (String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP') return 'WEBP';
  throw new Error('MEDIA_FORMAT_UNSUPPORTED');
}

export function configureImageLimits(runtime) {
  const r = runtime.ResourceLimits;
  r.memory = 128n * 1024n * 1024n; r.maxMemoryRequest = 96n * 1024n * 1024n; r.disk = 0n;
  r.area = BigInt(MEDIA_LIMITS.maxDecodedPixels); r.width = 16000n; r.height = 16000n;
  r.listLength = 4n; r.maxProfileSize = 4n * 1024n * 1024n; r.time = 2n;
}

export function sanitizeImage(bytes, contentType, runtime) {
  const codec = imageCodec(bytes), types = { JPEG:'image/jpeg', PNG:'image/png', WEBP:'image/webp' };
  if (types[codec] !== contentType) throw new Error('MEDIA_FORMAT_UNSUPPORTED');
  const formats = { JPEG:runtime.MagickFormat.Jpeg, PNG:runtime.MagickFormat.Png, WEBP:runtime.MagickFormat.WebP };
  const settings = new runtime.MagickReadSettings({ format: formats[codec], frameIndex: 0, frameCount: 1, syncImageWithExifProfile:true });
  // Header ping precedes pixel allocation for every admitted codec. Do not use
  // jpeg:size here: this decoder can upscale small images at the DCT stage.
  const info = runtime.MagickImageInfo.create(bytes, settings);
  if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height) || info.width < 1 || info.height < 1
    || info.width > MEDIA_LIMITS.maxDecodedEdge || info.height > MEDIA_LIMITS.maxDecodedEdge
    || info.width * info.height > MEDIA_LIMITS.maxDecodedPixels) throw new Error('MEDIA_DIMENSIONS_TOO_LARGE');
  return runtime.ImageMagick.read(bytes, settings, img => {
    img.autoOrient();
    const scale = Math.min(1, MEDIA_LIMITS.maxEdge / Math.max(img.width,img.height));
    if (scale < 1) img.resize(Math.max(1,Math.round(img.width*scale)),Math.max(1,Math.round(img.height*scale)));
    img.backgroundColor = runtime.MagickColors.White;
    img.alpha(runtime.AlphaAction.Remove);
    img.colorSpace = runtime.ColorSpace.sRGB;
    img.strip(); // after orientation; removes EXIF/GPS/XMP/ICC and comments.
    img.quality = 82;
    return img.write(runtime.MagickFormat.Jpeg, output => {
      if (output.length < 1 || output.length > MEDIA_LIMITS.outputBytes || img.width > 1600 || img.height > 1600
        || img.profileNames.length !== 0 || img.attributeNames.some(x => /^(exif|gps|xmp|comment)/i.test(x))) throw new Error('MEDIA_SANITIZATION_FAILED');
      return { bytes: new Uint8Array(output), width:img.width, height:img.height, contentType:'image/jpeg' };
    });
  });
}
