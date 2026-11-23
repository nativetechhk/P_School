// 自包含 HTML 輪播產生器（§5.1 CarouselBuilder / carousel_html 要求）
// 圖片以 base64 內嵌、無外部 CDN、自動輪播 + 鍵盤 ←→ + 暫停 + 全螢幕。

export interface CarouselSlide {
  imgDataUri: string;
  lessonName: string;
  promptZh?: string;
  caption?: string; // 學生旁白
  painterLabel?: string; // 畫家
  paletteHex?: string[]; // 5 色
  date?: string;
}

export interface CarouselInput {
  title: string;
  cover: { who: string; className: string; courseName: string };
  slides: CarouselSlide[];
  reflection?: string[]; // 我學到的 AI
}

function esc(s: string): string {
  return (s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
}

export function buildCarouselHtml(input: CarouselInput): string {
  const cover = `<section class="slide cover">
    <div class="cover-emoji">🎨✨</div>
    <h1>${esc(input.title) || '我的 AI 作品集'}</h1>
    <div class="cover-meta">${esc(input.cover.who)}</div>
    <div class="cover-sub">${esc(input.cover.className)} · ${esc(input.cover.courseName)}</div>
  </section>`;

  const slides = input.slides.map((s) => {
    const palette = (s.paletteHex ?? []).map((h) => `<span class="sw" style="background:${esc(h)}"></span>`).join('');
    const tags = [
      s.painterLabel ? `<span class="tag">🖼️ ${esc(s.painterLabel)}</span>` : '',
      palette ? `<span class="tag">🎨 ${palette}</span>` : '',
    ].filter(Boolean).join('');
    return `<section class="slide">
      <div class="pic"><img src="${s.imgDataUri}" alt="${esc(s.lessonName)}"/></div>
      <div class="info">
        <div class="lesson">${esc(s.lessonName)}</div>
        ${s.caption ? `<div class="caption">“${esc(s.caption)}”</div>` : ''}
        ${s.promptZh ? `<div class="prompt">${esc(s.promptZh)}</div>` : ''}
        <div class="tags">${tags}</div>
        ${s.date ? `<div class="date">${esc(s.date)}</div>` : ''}
      </div>
    </section>`;
  }).join('');

  const reflection = input.reflection?.filter(Boolean).length
    ? `<section class="slide reflect">
        <h2>💡 我學到的 AI</h2>
        ${input.reflection!.filter(Boolean).map((r) => `<p>${esc(r)}</p>`).join('')}
      </section>`
    : '';

  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title) || '我的 AI 作品集'}</title>
<style>
  :root { --accent:#ff6b9d; }
  * { box-sizing:border-box; margin:0; }
  html,body { height:100%; }
  body { font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif; background:#0f0b1a; color:#fff; overflow:hidden; }
  #deck { height:100vh; position:relative; }
  .slide { position:absolute; inset:0; display:none; flex-direction:row; align-items:center; justify-content:center; gap:3vw; padding:5vh 6vw; }
  .slide.active { display:flex; animation:fade .5s ease; }
  @keyframes fade { from{opacity:0; transform:scale(.98);} to{opacity:1; transform:none;} }
  .pic { flex:1; display:flex; align-items:center; justify-content:center; height:100%; }
  .pic img { max-width:100%; max-height:84vh; border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.5); object-fit:contain; }
  .info { width:34%; max-width:460px; }
  .lesson { font-size:clamp(20px,2.4vw,34px); font-weight:800; color:var(--accent); margin-bottom:14px; }
  .caption { font-size:clamp(20px,2.2vw,30px); line-height:1.5; margin-bottom:14px; }
  .prompt { font-size:clamp(16px,1.6vw,22px); opacity:.75; line-height:1.5; margin-bottom:14px; }
  .tags { display:flex; gap:10px; flex-wrap:wrap; }
  .tag { background:#ffffff1a; padding:8px 14px; border-radius:12px; font-size:18px; display:inline-flex; align-items:center; gap:6px; }
  .sw { width:22px; height:22px; border-radius:50%; display:inline-block; border:2px solid #fff6; }
  .date { opacity:.5; margin-top:14px; font-size:16px; }
  .cover, .reflect { flex-direction:column; text-align:center; gap:16px; }
  .cover { background:radial-gradient(circle at 50% 30%, #3a2b5e, #0f0b1a); }
  .cover-emoji { font-size:12vh; } h1 { font-size:clamp(34px,6vw,76px); }
  .cover-meta { font-size:clamp(24px,3vw,40px); font-weight:700; } .cover-sub { opacity:.7; font-size:clamp(18px,2vw,26px); }
  .reflect h2 { font-size:clamp(28px,4vw,48px); } .reflect p { font-size:clamp(22px,2.6vw,34px); line-height:1.6; max-width:80vw; }
  .ctrl { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); display:flex; gap:12px; z-index:10; }
  .ctrl button { background:#ffffff22; color:#fff; border:none; width:56px; height:56px; border-radius:50%; font-size:24px; cursor:pointer; }
  .ctrl button:hover { background:var(--accent); }
  .count { position:fixed; top:20px; right:24px; background:#00000055; padding:8px 16px; border-radius:20px; font-size:18px; z-index:10; }
</style></head><body>
<div id="deck">${cover}${slides}${reflection}</div>
<div class="count"><span id="cur">1</span> / <span id="tot">1</span></div>
<div class="ctrl">
  <button id="prev">←</button>
  <button id="play">⏸</button>
  <button id="next">→</button>
  <button id="fs">⛶</button>
</div>
<script>
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var i = 0, playing = true, timer = null, INTERVAL = 6000;
  document.getElementById('tot').textContent = slides.length;
  function show(n){ slides[i].classList.remove('active'); i=(n+slides.length)%slides.length; slides[i].classList.add('active'); document.getElementById('cur').textContent=i+1; }
  function next(){ show(i+1); } function prev(){ show(i-1); }
  function loop(){ if(playing) next(); }
  function restart(){ clearInterval(timer); timer=setInterval(loop, INTERVAL); }
  document.getElementById('next').onclick=function(){ next(); restart(); };
  document.getElementById('prev').onclick=function(){ prev(); restart(); };
  document.getElementById('play').onclick=function(e){ playing=!playing; e.target.textContent=playing?'⏸':'▶'; restart(); };
  document.getElementById('fs').onclick=function(){ if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
  document.addEventListener('keydown', function(e){ if(e.key==='ArrowRight'){next();restart();} else if(e.key==='ArrowLeft'){prev();restart();} });
  slides[0].classList.add('active'); restart();
</script>
</body></html>`;
}
