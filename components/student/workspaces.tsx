'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import PromptBuilder, { SlotDef } from './PromptBuilder';
import PriorWorksPicker, { Artifact } from './PriorWorksPicker';
import BeforeAfterSlider from './BeforeAfterSlider';
import JobWaiter from './JobWaiter';
import ColoringCanvas from './ColoringCanvas';

export interface LessonMeta {
  id: string; group: 'junior' | 'senior'; kind: string; lessonNo: number; title: string;
  aspect?: string; slots: string[]; slotLabels: Record<string, string>;
  actSlots?: { id: string; label: string; defaultC: string }[] | null;
  optionSets: Record<string, { id: string; icon?: string; labelZh: string }[]>;
  quota?: { canGenerate: boolean; reason?: string; lessonRemaining: number; lessonQuota: number; cooldownRemaining: number };
  consumes: string[];
}

function buildSlots(meta: LessonMeta): SlotDef[] {
  // 從 optionSets key 順序組 slot（跳過 D 已鎖的情況保留）
  const optionSetNames = (meta as unknown as { optionSetNames?: Record<string, string> });
  void optionSetNames;
  return (meta.slots || Object.keys(meta.optionSets)).map((slot) => ({
    slot,
    label: meta.slotLabels[slot] ?? slot,
    setName: (meta as unknown as { optionSetsRaw?: Record<string, string> }).optionSetsRaw?.[slot],
    options: meta.optionSets[slot] ?? [],
  }));
}

function Results({ ids, onFavorite }: { ids: string[]; onFavorite?: (id: string) => void }) {
  const [arts, setArts] = useState<Artifact[]>([]);
  useEffect(() => {
    if (!ids.length) return;
    api<{ artifacts: Artifact[] }>(`/api/artifacts`).then((r) => setArts(r.artifacts.filter((a) => ids.includes(a.id))));
  }, [ids]);
  if (!arts.length) return null;
  return (
    <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
      {arts.map((a) => (
        <div key={a.id} className="card flyin" style={{ padding: 10 }}>
          <img src={a.url} alt={a.promptZh} style={{ borderRadius: 12, aspectRatio: meta_aspect, objectFit: 'cover' }} />
          {onFavorite && <button className="btn secondary" style={{ marginTop: 8, width: '100%' }} onClick={() => onFavorite(a.id)}>⭐ 最鍾意</button>}
        </div>
      ))}
    </div>
  );
}
const meta_aspect = '1';

function QuotaBar({ quota }: { quota?: LessonMeta['quota'] }) {
  if (!quota) return null;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
      <span>🎟️ 仲可以畫 <b>{quota.lessonRemaining}</b> / {quota.lessonQuota} 次</span>
      {quota.cooldownRemaining > 0 && <span style={{ color: 'var(--color-accent)' }}>⏳ 等多 {quota.cooldownRemaining} 秒</span>}
    </div>
  );
}

/** 文生圖工作區（senior-l3 / senior-l4） */
export function GenerateWorkspace({ meta, optionSetsRaw }: { meta: LessonMeta; optionSetsRaw: Record<string, string> }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [quota, setQuota] = useState(meta.quota);
  const [activeAct, setActiveAct] = useState(meta.actSlots?.[0]?.id ?? null);

  const slots = buildSlots({ ...meta, ...({ optionSetsRaw } as object) });

  const refreshQuota = useCallback(async () => {
    const r = await api<{ lessons: LessonMeta[] }>('/api/lessons');
    const l = r.lessons.find((x) => x.id === meta.id);
    if (l?.quota) setQuota(l.quota);
  }, [meta.id]);

  async function generate() {
    setErr('');
    try {
      const role = meta.actSlots ? activeAct! : undefined;
      const r = await api<{ jobId: string }>('/api/generate/image', {
        json: { lessonId: meta.id, slots: sel, freeTexts, role },
      });
      setJobId(r.jobId); setResultIds([]);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <QuotaBar quota={quota} />
      {meta.consumes.includes('character') && (
        <details className="card">
          <summary style={{ fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>🔗 睇返第 3 節主角（參考）</summary>
          <div style={{ marginTop: 12 }}><PriorWorksPicker roles={['character', 'character_card']} onSelect={() => {}} demoFallback /></div>
        </details>
      )}

      {meta.actSlots && (
        <div style={{ display: 'flex', gap: 8 }}>
          {meta.actSlots.map((act) => (
            <button key={act.id} className="btn" style={{ flex: 1, background: activeAct === act.id ? 'var(--color-accent-2)' : '#fff', color: activeAct === act.id ? '#fff' : 'var(--color-ink)', boxShadow: 'var(--shadow-sm)' }}
              onClick={() => setActiveAct(act.id)}>{act.label}</button>
          ))}
        </div>
      )}

      <PromptBuilder slots={slots} group={meta.group} onChange={(s, f, sent) => { setSel(s); setFreeTexts(f); setSentence(sent); }} />

      {sentence && (
        <div className="card" style={{ background: '#fff6fb', fontSize: 22 }}>
          🗣️ <b>{sentence}</b>
        </div>
      )}

      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}

      {jobId ? (
        <JobWaiter jobId={jobId} onDone={(ids) => { setResultIds(ids); setJobId(null); refreshQuota(); }} onFail={(e) => { setErr(e); setJobId(null); refreshQuota(); }} />
      ) : (
        <button className="btn lg" onClick={generate} disabled={!sentence || !(quota?.canGenerate ?? true)}>
          {quota && !quota.canGenerate ? quota.reason : '✨ 生成（2 張）'}
        </button>
      )}

      {resultIds.length > 0 && (
        <>
          <h3>你嘅新作品 🎉</h3>
          <Results ids={resultIds} />
          {meta.id === 'senior-l3-character' && <CharacterCardMaker artifactIds={resultIds} />}
        </>
      )}
    </div>
  );
}

/** senior-l3 設定卡合成 */
function CharacterCardMaker({ artifactIds }: { artifactIds: string[] }) {
  const [name, setName] = useState('');
  const [traits, setTraits] = useState(['', '', '']);
  const [done, setDone] = useState<string | null>(null);
  async function make() {
    const r = await api<{ artifactId: string }>('/api/compose/card', { json: { sourceArtifactId: artifactIds[0], name, traits } });
    const list = await api<{ artifacts: Artifact[] }>(`/api/artifacts?role=character_card`);
    setDone(list.artifacts.find((a) => a.id === r.artifactId)?.url ?? null);
  }
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>🪪 整張設定卡</h3>
      <input className="field" placeholder="主角個名" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      {traits.map((t, i) => (
        <input key={i} className="field" style={{ marginTop: 8 }} placeholder={`特徵 ${i + 1}`} value={t} maxLength={20}
          onChange={(e) => setTraits(traits.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      <button className="btn" style={{ marginTop: 10 }} onClick={make} disabled={!name}>整設定卡</button>
      {done && <img src={done} alt="設定卡" style={{ marginTop: 12, borderRadius: 12, maxWidth: 300 }} />}
    </div>
  );
}

/** 圖生圖風格轉換（senior-l5 / junior-l4） */
export function EditWorkspace({ meta, optionSetsRaw }: { meta: LessonMeta; optionSetsRaw: Record<string, string> }) {
  const styleSet = meta.optionSets['STYLE'] ?? [];
  const styleSetName = optionSetsRaw['STYLE'] ?? 'masters';
  const [sources, setSources] = useState<Artifact[]>([]);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<{ before: string; after: string }[]>([]);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const isJunior = meta.group === 'junior';

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file); fd.append('role', 'pet_original'); fd.append('lessonId', meta.id);
    const r = await api<{ artifactId: string }>('/api/upload', { method: 'POST', body: fd });
    const list = await api<{ artifacts: Artifact[] }>(`/api/artifacts?role=pet_original`);
    const a = list.artifacts.find((x) => x.id === r.artifactId);
    if (a) setSources([a]);
    setUploading(false);
  }

  async function convert() {
    setErr('');
    if (!styleId || !sources.length) return;
    try {
      const r = await api<{ jobId: string }>('/api/edit-image', { json: { lessonId: meta.id, sourceArtifactId: sources[0].id, styleId } });
      setJobId(r.jobId);
    } catch (e) { setErr((e as Error).message); }
  }

  async function onDone(ids: string[]) {
    const list = await api<{ artifacts: Artifact[] }>(`/api/artifacts`);
    const after = list.artifacts.find((a) => ids.includes(a.id));
    if (after && sources[0]) setPairs([...pairs, { before: sources[0].url, after: after.url }]);
    setJobId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <QuotaBar quota={meta.quota} />
      <section className="card">
        <h3>1️⃣ 揀圖{isJunior ? '（上載第 2 節寵物相）' : '（第 3、4 節作品，最多 4 張）'}</h3>
        {isJunior ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn secondary">
              {uploading ? '上載中…' : '📤 上載寵物 PNG'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {sources[0] && <img src={sources[0].url} alt="已上載" style={{ height: 100, borderRadius: 10 }} />}
          </div>
        ) : (
          <PriorWorksPicker roles={['character', 'scene_1', 'scene_2', 'scene_3']} multi max={4} onSelect={setSources} demoFallback />
        )}
      </section>

      <section className="card">
        <h3>2️⃣ 揀大師</h3>
        <div className="grid-cards">
          {styleSet.map((s) => (
            <button key={s.id} onClick={() => setStyleId(s.id)}
              style={{ border: styleId === s.id ? '4px solid var(--color-accent)' : '4px solid transparent', borderRadius: 16, padding: 16, background: '#fff', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 40 }}>{s.icon}</div>
              <div style={{ fontWeight: 800 }}>{s.labelZh}</div>
            </button>
          ))}
        </div>
      </section>

      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}
      {jobId ? (
        <JobWaiter jobId={jobId} onDone={onDone} onFail={(e) => { setErr(e); setJobId(null); }} />
      ) : (
        <button className="btn lg" onClick={convert} disabled={!styleId || !sources.length}>🪄 變！（每張計 1 次）</button>
      )}
      {void styleSetName}

      {pairs.map((p, i) => (
        <section key={i} className="card"><h3>轉換 {i + 1}</h3><BeforeAfterSlider before={p.before} after={p.after} /></section>
      ))}
    </div>
  );
}

/** junior-l5 顏色配方 + 填色 */
export function PaletteWorkspace({ meta }: { meta: LessonMeta }) {
  const [source, setSource] = useState<Artifact | null>(null);
  const [colors, setColors] = useState<{ hex: string }[]>([]);
  const [paletteId, setPaletteId] = useState<string | null>(null);

  async function findColors() {
    if (!source) return;
    const r = await api<{ colors: { hex: string }[]; artifactId: string }>('/api/vision/colors', { json: { artifactId: source.id } });
    setColors(r.colors); setPaletteId(r.artifactId);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card">
        <h3>1️⃣ 揀返你隻寵物圖</h3>
        <PriorWorksPicker roles={['styled_pet', 'pet_original']} onSelect={(a) => setSource(a[0] ?? null)} demoFallback />
      </section>
      <button className="btn lg" onClick={findColors} disabled={!source}>🎨 搵出 5 隻主色</button>
      {colors.length > 0 && (
        <section className="card">
          <h3>你嘅顏色配方</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {colors.map((c, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: c.hex, boxShadow: 'var(--shadow)' }} />
                <div style={{ fontSize: 13 }}>{c.hex}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {colors.length > 0 && <ColoringCanvas palette={colors.map((c) => c.hex)} paletteArtifactId={paletteId ?? undefined} />}
    </div>
  );
}
