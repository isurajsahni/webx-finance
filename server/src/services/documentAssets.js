// Fonts and logo inlined as data URIs so PDFs render with no network access.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storage } from './storage/index.js';

const require = createRequire(import.meta.url);
const DEFAULT_LOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../shared/templates/assets/logo.svg');

let fontCssCache = null;
let footerFontCache = null;

/** Small Lato subset (latin 400/700) for Puppeteer's isolated footer template. */
export async function footerFontCss() {
  if (footerFontCache) return footerFontCache;
  const dir = path.join(path.dirname(require.resolve('@fontsource/lato/package.json')), 'files');
  const faces = await Promise.all(
    [400, 700].map(async (w) => {
      const data = await fs.readFile(path.join(dir, `lato-latin-${w}-normal.woff2`));
      return `@font-face{font-family:'Lato';font-weight:${w};src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');}`;
    }),
  );
  footerFontCache = faces.join('');
  return footerFontCache;
}

async function fontCss() {
  if (fontCssCache) return fontCssCache;
  const dir = path.join(path.dirname(require.resolve('@fontsource/lato/package.json')), 'files');
  const faces = await Promise.all(
    [400, 700, 900].flatMap((weight) =>
      ['latin', 'latin-ext'].map(async (subset) => {
        const data = await fs.readFile(path.join(dir, `lato-${subset}-${weight}-normal.woff2`)).catch(() => null);
        if (!data) return '';
        return `@font-face{font-family:'Lato';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');}`;
      }),
    ),
  );
  fontCssCache = faces.join('');
  return fontCssCache;
}

async function logoSrc(settings) {
  const logo = settings?.company?.logo;
  if (logo?.key && (await storage.exists(logo.key))) {
    const data = await storage.read(logo.key);
    return `data:${logo.mimeType};base64,${data.toString('base64')}`;
  }
  const svg = await fs.readFile(DEFAULT_LOGO);
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

/**
 * Fonts, studio logo, and any uploaded files the document references (e.g. a
 * client logo), all inlined as data URIs. Templates look files up with
 * assets.resolveFile(key).
 */
export async function documentAssets(settings, { files = [] } = {}) {
  const [css, logo] = await Promise.all([fontCss(), logoSrc(settings)]);
  const inlined = new Map();
  for (const key of files.filter(Boolean)) {
    if (!(await storage.exists(key).catch(() => false))) continue;
    const data = await storage.read(key);
    inlined.set(key, `data:${MIME[path.extname(key)] || 'application/octet-stream'};base64,${data.toString('base64')}`);
  }
  const sig = settings?.company?.signature;
  let signatureSrc = '';
  if (sig?.key && (await storage.exists(sig.key).catch(() => false))) {
    signatureSrc = `data:${sig.mimeType};base64,${(await storage.read(sig.key)).toString('base64')}`;
  }
  return { fontCss: css, logoSrc: logo, signatureSrc, resolveFile: (key) => inlined.get(key) || '' };
}
