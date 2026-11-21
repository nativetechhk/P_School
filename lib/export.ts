// 匯出引擎（§3.6／§5.5）：HTML→PDF/PNG（puppeteer-core + 系統 Chrome）、DOCX、ZIP
import { existsSync } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Document, Packer, Paragraph, ImageRun, TextRun, HeadingLevel } from 'docx';
import { storage } from './storage';
import { prisma } from './db';
import type { Artifact } from '@prisma/client';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean) as string[];

export function findChrome(): string | null {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  return null;
}

// 記憶體受限伺服器上穩定的 headless Chrome 啟動參數（避免 Target.createTarget timeout）
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
];
const PROTOCOL_TIMEOUT = 120000;

async function launchBrowser() {
  const puppeteer = await import('puppeteer-core');
  const chromePath = findChrome();
  if (!chromePath) throw new Error('CHROME_NOT_FOUND：請安裝 Chrome 或設定 CHROME_PATH');
  return puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    protocolTimeout: PROTOCOL_TIMEOUT,
    args: LAUNCH_ARGS,
  });
}

export async function htmlToPdf(html: string, opts?: { landscape?: boolean; format?: 'A4' | 'A6' }): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({
      format: opts?.format ?? 'A4', landscape: opts?.landscape ?? false,
      printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function htmlToPng(html: string, width: number, height: number): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    return Buffer.from(await page.screenshot({ type: 'png' })) as Buffer;
  } finally {
    await browser.close();
  }
}

export async function imageDataUri(relPath: string): Promise<string> {
  const buf = await storage.read(relPath);
  const ext = path.extname(relPath).slice(1) || 'png';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

export async function artifactsToZip(artifacts: Artifact[]): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('error', reject);
  });
  for (const a of artifacts) {
    const buf = await storage.read(a.filePath).catch(() => null);
    if (!buf) continue;
    const ext = path.extname(a.filePath) || '.png';
    archive.append(buf, { name: `${a.lessonId}/${a.role}_${a.id.slice(0, 6)}${ext}` });
  }
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

export async function artifactsToDocx(artifacts: Artifact[], title: string): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title })] }),
  ];
  for (const a of artifacts) {
    if (a.type !== 'image') continue;
    const buf = await storage.read(a.filePath).catch(() => null);
    if (!buf) continue;
    children.push(
      new Paragraph({
        children: [new ImageRun({ type: 'png', data: buf, transformation: { width: 480, height: 480 } })],
      }),
      new Paragraph({ children: [new TextRun({ text: a.promptZh ?? '', size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: a.createdAt.toLocaleDateString('zh-HK'), size: 20, color: '888888' })] })
    );
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc) as Promise<Buffer>;
}

/** 作品集 PDF（§5.5 全程作品集）：封面 + 每節一頁 + 末頁三句話 */
export async function portfolioPdf(studentId: string): Promise<Buffer> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } });
  const artifacts = await prisma.artifact.findMany({
    where: { studentId, status: 'ok', type: 'image' },
    orderBy: [{ lessonId: 'asc' }, { favorite: 'desc' }, { createdAt: 'desc' }],
  });
  const byLesson = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    if (!byLesson.has(a.lessonId)) byLesson.set(a.lessonId, []);
    byLesson.get(a.lessonId)!.push(a);
  }
  const sentences = await prisma.setting.findFirst({ where: { key: `three_sentences:${studentId}` } });
  const threeSentences = (sentences?.value as string[] | undefined) ?? [];

  let pages = `<div class="page cover"><h1>我的 AI 故事作品集</h1><div class="big">${student.nickname ?? student.username}</div><div class="cls">${student.class.name}</div></div>`;
  for (const [lessonId, list] of byLesson) {
    const a = list[0];
    const uri = await imageDataUri(a.filePath).catch(() => '');
    pages += `<div class="page"><h2>${lessonId}</h2><img src="${uri}"/><p class="prompt">${a.promptZh ?? ''}</p><p class="meta">${a.createdAt.toLocaleDateString('zh-HK')} ${'❤'.repeat(a.teacherHeart)}</p></div>`;
  }
  if (threeSentences.length) {
    pages += `<div class="page"><h2>我學到的 AI</h2>${threeSentences.map((s) => `<p class="big">${s}</p>`).join('')}</div>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    body { margin: 0; font-family: "PingFang TC", "Noto Sans TC", sans-serif; }
    .page { width: 210mm; height: 296mm; padding: 20mm; box-sizing: border-box; page-break-after: always;
            display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .cover { background: linear-gradient(160deg,#ffe9a8,#ffb3c1); }
    h1 { font-size: 42px; } h2 { font-size: 28px; color: #555; }
    .big { font-size: 34px; margin: 12px; } .cls { color: #777; font-size: 20px; }
    img { max-width: 160mm; max-height: 180mm; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.15); }
    .prompt { font-size: 18px; max-width: 160mm; } .meta { color: #999; }
  </style></head><body>${pages}</body></html>`;
  return htmlToPdf(html);
}
