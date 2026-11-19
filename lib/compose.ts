// 合成引擎：設定卡 / 海報 / 故事書 → HTML → PNG/PDF
import { imageDataUri, htmlToPng, htmlToPdf } from './export';

const FONT = `font-family: "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;`;

export async function composeCharacterCard(opts: {
  imagePath: string; name: string; traits: string[];
}): Promise<Buffer> {
  const uri = await imageDataUri(opts.imagePath);
  const traits = opts.traits.filter(Boolean).slice(0, 3);
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="width:768px;height:1024px;${FONT}
    background:linear-gradient(160deg,#fff7e6,#ffe0ec);display:flex;flex-direction:column;align-items:center;padding:40px;box-sizing:border-box">
    <div style="font-size:48px;font-weight:800;color:#c2185b;margin-bottom:16px">${esc(opts.name) || '我的主角'}</div>
    <img src="${uri}" style="width:640px;height:640px;object-fit:cover;border-radius:24px;box-shadow:0 12px 40px rgba(0,0,0,.2)"/>
    <div style="margin-top:28px;display:flex;flex-direction:column;gap:14px;width:100%">
      ${traits.map((t, i) => `<div style="background:#fff;border-radius:16px;padding:16px 22px;font-size:28px;box-shadow:0 4px 12px rgba(0,0,0,.08)">${['✨', '💪', '❤️'][i]} ${esc(t)}</div>`).join('')}
    </div></div></body>`;
  return htmlToPng(html, 768, 1024);
}

export async function composePoster(opts: {
  originalPath?: string; styledPath?: string; coloringPath?: string;
  name: string; sentences: string[];
}): Promise<Buffer> {
  const orig = opts.originalPath ? await imageDataUri(opts.originalPath) : '';
  const styled = opts.styledPath ? await imageDataUri(opts.styledPath) : (opts.coloringPath ? await imageDataUri(opts.coloringPath) : '');
  const sentences = opts.sentences.filter(Boolean).slice(0, 3);
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="width:1123px;height:794px;${FONT}
    background:linear-gradient(135deg,#e3f2fd,#fce4ec);padding:40px;box-sizing:border-box;display:flex;flex-direction:column">
    <div style="font-size:44px;font-weight:800;text-align:center;color:#6a1b9a;margin-bottom:20px">🐾 ${esc(opts.name) || '我的魔法寵物'}</div>
    <div style="display:flex;gap:24px;flex:1">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center">
        <div style="font-size:24px;margin-bottom:10px">我畫嘅</div>
        ${orig ? `<img src="${orig}" style="width:100%;max-height:360px;object-fit:contain;border-radius:18px;background:#fff;padding:8px"/>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center">
        <div style="font-size:24px;margin-bottom:10px">名畫風</div>
        ${styled ? `<img src="${styled}" style="width:100%;max-height:360px;object-fit:contain;border-radius:18px;background:#fff;padding:8px"/>` : ''}
      </div>
    </div>
    <div style="margin-top:20px;display:flex;gap:16px;justify-content:center">
      ${sentences.map((s) => `<div style="background:#fff;border-radius:16px;padding:16px 20px;font-size:26px;max-width:320px">${esc(s)}</div>`).join('')}
    </div></div></body>`;
  return htmlToPng(html, 1123, 794);
}

export interface StorybookPage { image?: string; text: string; heading?: string }

export async function composeStorybook(opts: { title: string; pages: StorybookPage[] }): Promise<Buffer> {
  let body = `<div class="page cover"><h1>${esc(opts.title) || '我的 AI 故事書'}</h1></div>`;
  for (const p of opts.pages) {
    body += `<div class="page">${p.heading ? `<h2>${esc(p.heading)}</h2>` : ''}
      ${p.image ? `<img src="${p.image}"/>` : ''}<p>${esc(p.text)}</p></div>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:0} body{margin:0;${FONT}}
    .page{width:297mm;height:209mm;padding:18mm;box-sizing:border-box;page-break-after:always;
      display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#fffdf7}
    .cover{background:linear-gradient(160deg,#c8e6c9,#b3e5fc)} h1{font-size:52px} h2{font-size:30px;color:#555}
    img{max-width:220mm;max-height:130mm;object-fit:contain;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.15)}
    p{font-size:26px;max-width:220mm;margin-top:16px}
  </style></head><body>${body}</body></html>`;
  return htmlToPdf(html, { landscape: true });
}

function esc(s: string): string {
  return (s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
}
