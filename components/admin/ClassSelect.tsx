'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface Cls { id: string; name: string; group: string }

export default function ClassSelect({ value, onChange }: { value: string; onChange: (id: string, cls?: Cls) => void }) {
  const [classes, setClasses] = useState<Cls[]>([]);
  useEffect(() => {
    api<{ classes: Cls[] }>('/api/admin/classes').then((r) => {
      setClasses(r.classes);
      if (!value && r.classes[0]) onChange(r.classes[0].id, r.classes[0]);
    }).catch(() => {});
  }, []); // eslint-disable-line
  return (
    <select className="field" style={{ maxWidth: 280 }} value={value} onChange={(e) => onChange(e.target.value, classes.find((c) => c.id === e.target.value))}>
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.group === 'senior' ? '高' : '低'}）</option>)}
    </select>
  );
}
