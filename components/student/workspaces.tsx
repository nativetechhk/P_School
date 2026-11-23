'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import PromptBuilder, { SlotDef } from './PromptBuilder';
import PriorWorksPicker, { Artifact } from './PriorWorksPicker';
import BeforeAfterSlider from './BeforeAfterSlider';
import JobWaiter from './JobWaiter';
import PainterPicker, { Painter } from './PainterPicker';
import FiveColorGrid, { ColorItem } from './FiveColorGrid';

export interface OptionItem { id: string; icon?: string; labelZh: string; blurb?: string | null; en?: string | null; deathYear?: number | null; famousWorks?: { zh: string; year?: number }[] | null; hex?: string | null }
export type OptionSets = Record<string, OptionItem[]>;

export interface LessonMeta {
  id: string; group: 'junior' | 'senior'; kind: string; lessonNo: number; title: string;
  aspect?: string; consumes: string[]; produces: string[];
  data: Record<string, unknown>;
  quota?: { canGenerate: boolean; reason?: string; lessonRemaining: number; lessonQuota: number; cooldownRemaining: number };
}

type Cfg = { slots?: string[]; slotLabels?: Record<string, string>; optionSets?: Record<string, string>; template?: string };

function slotDefs(cfg: Cfg | undefined, optionSets: OptionSets): SlotDef[] {
  if (!cfg?.slots) return [];
  const labels = cfg.slotLabels ?? {};
  const sets = cfg.optionSets ?? {};
  return cfg.slots.map((slot) => ({
    slot, label: labels[slot] ?? slot, setName: sets[slot],
    options: (optionSets[sets[slot]] ?? []).map((o) => ({ id: o.id, icon: o.icon, labelZh: o.labelZh })),
  }));
}

export function QuotaBar({ quota }: { quota?: LessonMeta['quota'] }) {
  if (!quota) return null;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
      <span>🎟️ 仲可以畫 <b>{quota.lessonRemaining}</b> / {quota.lessonQuota} 次</span>
      {quota.cooldownRemaining > 0 && <span style={{ color: 'var(--color-accent)' }}>⏳ 等多 {quota.cooldownRemaining} 秒</span>}
    </div>
  );
}

function BlockedAlert({ msg, onClose }: { msg: string; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div role="alert" className="flyin" style={{ background: 'linear-gradient(160deg,#fff3cd,#ffd5d5)', border: '3px solid var(--color-danger)', borderRadius: 18, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 22 }}>{msg}</div>
        <div style={{ color: 'var(--color-muted)' }}>你輸入嘅字唔可以用，換個講法再試啦 🐱🦄</div>
      </div>
      <button className="btn secondary" onClick={onClose}>知道喇</button>
    </div>
  );
}

export function Results({ ids }: { ids: string[] }) {
  const [arts, setArts] = useState<Artifact[]>([]);
  useEffect(() => {
    if (!ids.length) return;
    api<{ artifacts: Artifact[] }>(`/api/artifacts`).then((r) => setArts(r.artifacts.filter((a) => ids.includes(a.id))));
  }, [ids]);
  if (!arts.length) return null;
  return (
    <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
      {arts.map((a) => {
        const cc = (a.params as { colorCheck?: { overflow?: number } } | undefined)?.colorCheck;
        return (
          <div key={a.id} className="card flyin" style={{ padding: 10 }}>
            <img src={a.url} alt={a.promptZh} style={{ borderRadius: 12, width: '100%' }} />
            {cc && (cc.overflow ?? 0) > 0 && <div style={{ color: 'var(--color-accent)', marginTop: 6, fontWeight: 700 }}>🎨 AI 偷加咗 {cc.overflow} 隻色！</div>}
          </div>
        );
      })}
    </div>
  );
}

async function refreshQuotaFor(id: string, setQuota: (q: LessonMeta['quota']) => void) {
  const r = await api<{ lessons: LessonMeta[] }>('/api/lessons');
  const l = r.lessons.find((x) => x.id === id);
  if (l?.quota) setQuota(l.quota);
}

/** 文生圖（senior-l3 / senior-l4）。senior-l4 有三幕 + 五色模式 */
export function GenerateWorkspace({ meta, optionSets }: { meta: LessonMeta; optionSets: OptionSets }) {
  const data = meta.data as { actSlots?: { id: string; label: string }[]; fiveColorMode?: { enabled?: boolean } };
  const [sel, setSel] = useState<Record<string, string>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [err, setErr] = useState(''); const [blocked, setBlocked] = useState('');
  const [quota, setQuota] = useState(meta.quota);
  const [activeAct, setActiveAct] = useState(data.actSlots?.[0]?.id ?? null);
  const [fiveOn, setFiveOn] = useState(false);
  const [palette, setPalette] = useState<ColorItem[]>([]);

  const slots = slotDefs(meta.data as Cfg, optionSets);

  async function generate() {
    setErr(''); setBlocked('');
    const role = data.actSlots ? activeAct! : undefined;
    const pal = fiveOn ? palette.map((c) => ({ zh: c.labelZh, hex: c.hex })) : undefined;
    if (fiveOn && (!pal || pal.length < 1)) { setErr('揀返 5 隻色先'); return; }
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string; blocked?: boolean }>('/api/generate/image', {
        json: { lessonId: meta.id, slots: sel, freeTexts, role, palette: pal },
      });
      if (r.ok === false) { r.blocked ? setBlocked(r.error || '') : setErr(r.error || '生成失敗'); return; }
      setJobId(r.jobId!); setResultIds([]);
    } catch (e) {
      const er = e as { message: string; data?: { blocked?: boolean; error?: string } };
      er.data?.blocked ? setBlocked(er.data.error || er.message) : setErr(er.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BlockedAlert msg={blocked} onClose={() => setBlocked('')} />
      <QuotaBar quota={quota} />
      {meta.consumes.includes('character') && (
        <details className="card">
          <summary style={{ fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>🔗 睇返第 3 節主角（參考）</summary>
          <div style={{ marginTop: 12 }}><PriorWorksPicker roles={['character', 'character_card']} onSelect={() => {}} demoFallback /></div>
        </details>
      )}

      {data.actSlots && (
        <div style={{ display: 'flex', gap: 8 }}>
          {data.actSlots.map((act) => (
            <button key={act.id} className="btn" style={{ flex: 1, background: activeAct === act.id ? 'var(--color-accent-2)' : '#fff', color: activeAct === act.id ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }}
              onClick={() => setActiveAct(act.id)}>{act.label}</button>
          ))}
        </div>
      )}

      <PromptBuilder slots={slots} group={meta.group} onChange={(s, f, sent) => { setSel(s); setFreeTexts(f); setSentence(sent); }} />

      {data.fiveColorMode?.enabled && (
        <div className="card">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={fiveOn} onChange={(e) => setFiveOn(e.target.checked)} style={{ width: 24, height: 24 }} />
            🎨 五色挑戰（淨係用 5 隻色畫）
          </label>
          {fiveOn && <div style={{ marginTop: 12 }}><FiveColorGrid colors={(optionSets.colors14 ?? []).map((c) => ({ id: c.id, labelZh: c.labelZh, hex: c.hex! }))} onChange={setPalette} /></div>}
        </div>
      )}

      {sentence && <div className="card" style={{ background: '#fff6fb', fontSize: 22 }}>🗣️ <b>{sentence}</b></div>}
      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}

      {jobId ? (
        <JobWaiter jobId={jobId} onDone={(ids) => { setResultIds(ids); setJobId(null); refreshQuotaFor(meta.id, setQuota); }} onFail={(e) => { setErr(e); setJobId(null); refreshQuotaFor(meta.id, setQuota); }} />
      ) : (
        <button className="btn lg" onClick={generate} disabled={!sentence || !(quota?.canGenerate ?? true)}>
          {quota && !quota.canGenerate ? quota.reason : '✨ 生成（2 張）'}
        </button>
      )}

      {resultIds.length > 0 && (<><h3>你嘅新作品 🎉</h3><Results ids={resultIds} />{meta.id === 'senior-l3-character' && <CharacterCardMaker artifactIds={resultIds} />}</>)}
    </div>
  );
}

function CharacterCardMaker({ artifactIds }: { artifactIds: string[] }) {
  const [name, setName] = useState(''); const [traits, setTraits] = useState(['', '', '']); const [done, setDone] = useState<string | null>(null);
  async function make() {
    const r = await api<{ artifactId: string }>('/api/compose/card', { json: { sourceArtifactId: artifactIds[0], name, traits } });
    const list = await api<{ artifacts: Artifact[] }>(`/api/artifacts?role=character_card`);
    setDone(list.artifacts.find((a) => a.id === r.artifactId)?.url ?? null);
  }
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>🪪 整張設定卡</h3>
      <input className="field" placeholder="主角個名" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      {traits.map((t, i) => <input key={i} className="field" style={{ marginTop: 8 }} placeholder={`特徵 ${i + 1}`} value={t} maxLength={20} onChange={(e) => setTraits(traits.map((x, j) => (j === i ? e.target.value : x)))} />)}
      <button className="btn" style={{ marginTop: 10 }} onClick={make} disabled={!name}>整設定卡</button>
      {done && <img src={done} alt="設定卡" style={{ marginTop: 12, borderRadius: 12, maxWidth: 300 }} />}
    </div>
  );
}

/** 畫家風格二次創作（senior-l5）：揀作品（多）+ 揀畫家 → 逐張圖生圖 */
export function EditWorkspace({ meta, optionSets }: { meta: LessonMeta; optionSets: OptionSets }) {
  const [sources, setSources] = useState<Artifact[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<{ before: string; after: string }[]>([]);
  const [queue, setQueue] = useState<Artifact[]>([]);
  const [err, setErr] = useState('');
  const [quota, setQuota] = useState(meta.quota);
  const painters = (optionSets.masters ?? []) as Painter[];

  async function convertNext(list: Artifact[]) {
    if (!list.length || !styleId) { setQueue([]); return; }
    const [head, ...rest] = list;
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string }>('/api/edit-image', { json: { lessonId: meta.id, sourceArtifactId: head.id, styleId } });
      if (r.ok === false) { setErr(r.error || '轉換失敗'); setQueue([]); return; }
      setJobId(r.jobId!); setQueue(rest);
      (convertNext as unknown as { _src?: Artifact })._src = head;
    } catch (e) { setErr((e as Error).message); setQueue([]); }
  }
  async function onDone(ids: string[]) {
    const src = (convertNext as unknown as { _src?: Artifact })._src;
    const list = await api<{ artifacts: Artifact[] }>(`/api/artifacts`);
    const after = list.artifacts.find((a) => ids.includes(a.id));
    if (after && src) setPairs((p) => [...p, { before: src.url, after: after.url }]);
    setJobId(null); refreshQuotaFor(meta.id, setQuota);
    if (queue.length) convertNext(queue);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <QuotaBar quota={quota} />
      <section className="card"><h3>1️⃣ 揀你嘅作品（第 3、4 節，最多 4 張）</h3>
        <PriorWorksPicker roles={['character', 'scene_1', 'scene_2', 'scene_3']} multi max={4} onSelect={setSources} demoFallback /></section>
      <section className="card"><h3>2️⃣ 揀一位大師（可 hover 睇代表作）</h3>
        <PainterPicker painters={painters} value={styleId} onSelect={setStyleId} /></section>
      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}
      {jobId ? <JobWaiter jobId={jobId} onDone={onDone} onFail={(e) => { setErr(e); setJobId(null); }} />
        : <button className="btn lg" onClick={() => { setPairs([]); setErr(''); convertNext(sources); }} disabled={!styleId || !sources.length}>🪄 全部轉換（每張計 1 次）</button>}
      {pairs.map((p, i) => <section key={i} className="card"><h3>轉換 {i + 1}</h3><BeforeAfterSlider before={p.before} after={p.after} /></section>)}
    </div>
  );
}

/** junior-l4 兩步：生成寵物 → 畫家風格 */
export function TwoStepWorkspace({ meta, optionSets }: { meta: LessonMeta; optionSets: OptionSets }) {
  const data = meta.data as { step1?: Cfg; step2?: Cfg };
  const [tab, setTab] = useState<'ai' | 'upload'>('ai');
  const [sel, setSel] = useState<Record<string, string>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const [pet, setPet] = useState<Artifact | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<'gen' | 'style'>('gen');
  const [pair, setPair] = useState<{ before: string; after: string } | null>(null);
  const [err, setErr] = useState(''); const [blocked, setBlocked] = useState('');
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState(meta.quota);
  const step1Slots = slotDefs(data.step1, optionSets);
  const painters = (optionSets.masters ?? []) as Painter[];

  async function gen() {
    setErr(''); setBlocked('');
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string; blocked?: boolean }>('/api/generate/image', { json: { lessonId: meta.id, slots: sel, freeTexts, step: 'step1', role: 'pet_original' } });
      if (r.ok === false) { r.blocked ? setBlocked(r.error || '') : setErr(r.error || ''); return; }
      setJobId(r.jobId!);
    } catch (e) { const er = e as { message: string; data?: { blocked?: boolean; error?: string } }; er.data?.blocked ? setBlocked(er.data.error || '') : setErr(er.message); }
  }
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData(); fd.append('file', file); fd.append('role', 'pet_original'); fd.append('lessonId', meta.id);
    const r = await api<{ artifactId: string }>('/api/upload', { method: 'POST', body: fd });
    const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=pet_original');
    setPet(list.artifacts.find((a) => a.id === r.artifactId) ?? null); setBusy(false);
  }
  async function onGenDone(ids: string[]) {
    const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=pet_original');
    setPet(list.artifacts.find((a) => ids.includes(a.id)) ?? list.artifacts[0] ?? null);
    setJobId(null); refreshQuotaFor(meta.id, setQuota);
  }
  async function toStyle() {
    if (!pet || !styleId) return;
    setErr('');
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string }>('/api/edit-image', { json: { lessonId: meta.id, sourceArtifactId: pet.id, styleId, step: 'step2', role: 'styled_pet' } });
      if (r.ok === false) { setErr(r.error || ''); return; }
      setJobId(r.jobId!);
    } catch (e) { setErr((e as Error).message); }
  }
  async function onStyleDone(ids: string[]) {
    const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=styled_pet');
    const after = list.artifacts.find((a) => ids.includes(a.id));
    if (after && pet) setPair({ before: pet.url, after: after.url });
    setJobId(null); refreshQuotaFor(meta.id, setQuota);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BlockedAlert msg={blocked} onClose={() => setBlocked('')} />
      <QuotaBar quota={quota} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1, background: stage === 'gen' ? 'var(--color-accent-2)' : '#fff', color: stage === 'gen' ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }} onClick={() => setStage('gen')}>①畫寵物</button>
        <button className="btn" style={{ flex: 1, background: stage === 'style' ? 'var(--color-accent-2)' : '#fff', color: stage === 'style' ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }} onClick={() => setStage('style')} disabled={!pet}>②名畫魔術</button>
      </div>

      {stage === 'gen' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" style={{ flex: 1, background: tab === 'ai' ? 'var(--color-accent)' : undefined, color: tab === 'ai' ? '#fff' : undefined }} onClick={() => setTab('ai')}>🎨 AI 幫我畫</button>
            <button className="btn secondary" style={{ flex: 1, background: tab === 'upload' ? 'var(--color-accent)' : undefined, color: tab === 'upload' ? '#fff' : undefined }} onClick={() => setTab('upload')}>📤 上載我畫嘅</button>
          </div>
          {tab === 'ai' ? (
            <>
              <PromptBuilder slots={step1Slots} group="junior" onChange={(s, f, sent) => { setSel(s); setFreeTexts(f); setSentence(sent); }} />
              {sentence && <div className="card" style={{ background: '#fff6fb', fontSize: 22 }}>🗣️ <b>{sentence}</b></div>}
              {jobId && stage === 'gen' ? <JobWaiter jobId={jobId} onDone={onGenDone} onFail={(e) => { setErr(e); setJobId(null); }} />
                : <button className="btn lg" onClick={gen} disabled={!sentence || jobId !== null}>✨ 生成（2 張）</button>}
            </>
          ) : (
            <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn secondary">{busy ? '上載中…' : '📤 上載寵物 PNG'}<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            </div>
          )}
          {pet && <div className="card"><h3>揀咗呢隻 🐾</h3><img src={pet.url} alt="pet" style={{ maxWidth: 260, borderRadius: 12 }} /><div><button className="btn" style={{ marginTop: 10 }} onClick={() => setStage('style')}>下一步：名畫魔術 →</button></div></div>}
        </>
      )}

      {stage === 'style' && pet && (
        <>
          <section className="card"><h3>揀一位畫家（可 hover 睇代表作）</h3><PainterPicker painters={painters} value={styleId} onSelect={setStyleId} /></section>
          {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}
          {jobId && stage === 'style' ? <JobWaiter jobId={jobId} onDone={onStyleDone} onFail={(e) => { setErr(e); setJobId(null); }} />
            : <button className="btn lg" onClick={toStyle} disabled={!styleId}>🪄 變！（計 1 次）</button>}
          {pair && <section className="card"><h3>變咗喇 🎉</h3><BeforeAfterSlider before={pair.before} after={pair.after} /></section>}
        </>
      )}
    </div>
  );
}

/** junior-l5 五色魔法：重畫 或 直接畫 */
export function FiveColorWorkspace({ meta, optionSets }: { meta: LessonMeta; optionSets: OptionSets }) {
  const data = meta.data as { generate?: Cfg };
  const [tab, setTab] = useState<'redraw' | 'fresh'>('redraw');
  const [source, setSource] = useState<Artifact | null>(null);
  const [palette, setPalette] = useState<ColorItem[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [err, setErr] = useState(''); const [blocked, setBlocked] = useState('');
  const [quota, setQuota] = useState(meta.quota);
  const colors = (optionSets.colors14 ?? []).map((c) => ({ id: c.id, labelZh: c.labelZh, hex: c.hex! }));
  const genSlots = slotDefs(data.generate, optionSets);
  const pal = palette.map((c) => ({ zh: c.labelZh, hex: c.hex }));

  async function redraw() {
    if (!source || pal.length < 1) { setErr('揀返作品同 5 隻色'); return; }
    setErr('');
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string }>('/api/edit-image', { json: { lessonId: meta.id, sourceArtifactId: source.id, palette: pal, step: 'edit', role: 'five_color' } });
      if (r.ok === false) { setErr(r.error || ''); return; }
      setJobId(r.jobId!); setResultIds([]);
    } catch (e) { setErr((e as Error).message); }
  }
  async function fresh() {
    if (pal.length < 1) { setErr('揀返 5 隻色'); return; }
    setErr(''); setBlocked('');
    try {
      const r = await api<{ ok: boolean; jobId?: string; error?: string; blocked?: boolean }>('/api/generate/image', { json: { lessonId: meta.id, slots: sel, freeTexts, step: 'generate', palette: pal, role: 'five_color' } });
      if (r.ok === false) { r.blocked ? setBlocked(r.error || '') : setErr(r.error || ''); return; }
      setJobId(r.jobId!); setResultIds([]);
    } catch (e) { const er = e as { message: string; data?: { blocked?: boolean; error?: string } }; er.data?.blocked ? setBlocked(er.data.error || '') : setErr(er.message); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BlockedAlert msg={blocked} onClose={() => setBlocked('')} />
      <QuotaBar quota={quota} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1, background: tab === 'redraw' ? 'var(--color-accent-2)' : '#fff', color: tab === 'redraw' ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }} onClick={() => setTab('redraw')}>用作品重畫</button>
        <button className="btn" style={{ flex: 1, background: tab === 'fresh' ? 'var(--color-accent-2)' : '#fff', color: tab === 'fresh' ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }} onClick={() => setTab('fresh')}>直接畫新圖</button>
      </div>
      {tab === 'redraw' && <section className="card"><h3>1️⃣ 揀你隻寵物圖</h3><PriorWorksPicker roles={['styled_pet', 'pet_original']} onSelect={(a) => setSource(a[0] ?? null)} demoFallback /></section>}
      {tab === 'fresh' && <PromptBuilder slots={genSlots} group="junior" onChange={(s, f, sent) => { setSel(s); setFreeTexts(f); setSentence(sent); }} />}
      <section className="card"><h3>🎨 揀 5 隻色</h3><FiveColorGrid colors={colors} onChange={setPalette} /></section>
      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}
      {jobId ? <JobWaiter jobId={jobId} onDone={(ids) => { setResultIds(ids); setJobId(null); refreshQuotaFor(meta.id, setQuota); }} onFail={(e) => { setErr(e); setJobId(null); }} />
        : <button className="btn lg" onClick={tab === 'redraw' ? redraw : fresh} disabled={tab === 'fresh' && !sentence}>🌈 用 5 色畫！（計 1 次）</button>}
      {resultIds.length > 0 && (<><h3>你嘅新作品 🎉</h3><Results ids={resultIds} /></>)}
    </div>
  );
}
