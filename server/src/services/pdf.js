// HTML → A4 PDF with headless Chrome. One shared browser, a fresh page per render.
import puppeteer from 'puppeteer';
import { pdfFooterTemplate, PAGE_MARGIN } from '@webx/shared/templates/index.js';

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.connected) return b;
  }
  browserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const browser = await browserPromise;
  browser.on('disconnected', () => {
    browserPromise = null;
  });
  return browser;
}

export async function renderPdf(html, { footerText = '', footerFontCss = '' } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Documents are self-contained (fonts and logo inlined): block all network access.
    await page.setRequestInterception(true);
    page.on('request', (req) => (req.url().startsWith('data:') || req.url() === 'about:blank' ? req.continue() : req.abort()));
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: pdfFooterTemplate(footerText, footerFontCss),
      margin: PAGE_MARGIN,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closePdfBrowser() {
  const b = await browserPromise?.catch(() => null);
  browserPromise = null;
  await b?.close().catch(() => {});
}
