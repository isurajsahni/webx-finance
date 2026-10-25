// Fonts for the document preview iframe (the PDF server inlines the same files).
import lato400 from '@fontsource/lato/files/lato-latin-400-normal.woff2?url';
import lato700 from '@fontsource/lato/files/lato-latin-700-normal.woff2?url';
import lato900 from '@fontsource/lato/files/lato-latin-900-normal.woff2?url';
import lato400x from '@fontsource/lato/files/lato-latin-ext-400-normal.woff2?url';
import lato700x from '@fontsource/lato/files/lato-latin-ext-700-normal.woff2?url';

const abs = (u) => new URL(u, window.location.origin).href;
const face = (url, weight) => `@font-face{font-family:'Lato';font-style:normal;font-weight:${weight};font-display:block;src:url(${abs(url)}) format('woff2');}`;

export const previewFontCss = [face(lato400, 400), face(lato700, 700), face(lato900, 900), face(lato400x, 400), face(lato700x, 700)].join('');

export function previewAssets(settings) {
  return {
    fontCss: previewFontCss,
    logoSrc: settings?.company?.logoUrl ? abs(settings.company.logoUrl) : abs('/favicon.svg'),
    signatureSrc: settings?.company?.signatureUrl ? abs(settings.company.signatureUrl) : '',
    resolveFile: (key) => abs(`/api/files/${key}`), // uploaded files, e.g. client logos
  };
}
