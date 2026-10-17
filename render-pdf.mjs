// Renders the Urmack Watch design documents (HTML) to PDF using the system
// Microsoft Edge (Chromium) — no extra browser download needed.
//
// Usage: node docs/urmack-watch/render-pdf.mjs
// Output: docs/urmack-watch/pdf/Urmack-Watch-0{1,2,3}-*.pdf
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'pdf');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
];

const DOCUMENTS = [
  { html: 'architecture.html', pdf: 'Urmack-Watch-01-System-Architecture.pdf' },
  { html: 'flowcharts.html', pdf: 'Urmack-Watch-02-Flows-and-SDLC-Roadmap.pdf' },
  { html: 'designs.html', pdf: 'Urmack-Watch-03-Product-Designs.pdf' },
  { html: 'tech-stack.html', pdf: 'Urmack-Watch-04-Tech-Stack-and-Chain-Strategy.pdf' },
  { html: 'security.html', pdf: 'Urmack-Watch-05-Reading-and-Security-Playbook.pdf' },
];

async function findEdge() {
  const { access } = await import('node:fs/promises');
  for (const candidate of EDGE_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error(`No supported browser found. Tried:\n  ${EDGE_CANDIDATES.join('\n  ')}`);
}

async function main() {
  const executablePath = await findEdge();
  console.log(`Browser: ${executablePath}`);
  await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    for (const doc of DOCUMENTS) {
      const htmlPath = path.join(here, doc.html);
      const pdfPath = path.join(outDir, doc.pdf);
      await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0', timeout: 60_000 });
      // Give webfonts a moment to settle before printing.
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 400));
      await page.pdf({
        path: pdfPath,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="width:100%;font-size:7px;color:#8a948c;padding:0 14mm;display:flex;justify-content:space-between;font-family:monospace;">' +
          '<span>URMACK WATCH · CONFIDENTIAL</span>' +
          '<span><span class="pageNumber"></span>/<span class="totalPages"></span></span>' +
          '</div>',
        margin: { top: '0', bottom: '14mm', left: '0', right: '0' },
      });
      const info = await stat(pdfPath);
      console.log(`OK  ${doc.pdf}  ${(info.size / 1024).toFixed(0)} KB`);
    }
  } finally {
    await browser.close();
  }
  console.log(`Done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
