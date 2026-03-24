import { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import type { RestRequest } from '../types';

interface Props {
  onSelect: (req: RestRequest) => void;
  onClose: () => void;
}

type ResultItem = RestRequest & { collectionName: string };

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400', POST: 'text-yellow-400', PUT: 'text-blue-400',
  PATCH: 'text-purple-400', DELETE: 'text-red-400', HEAD: 'text-gray-400', OPTIONS: 'text-gray-400',
};

export default function QuickOpen({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<ResultItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([db.requests.toArray(), db.collections.toArray()]).then(([requests, collections]) => {
      const colMap = new Map(collections.map(c => [c.id, c.name]));
      setAllResults(requests.map(r => ({ ...r, collectionName: colMap.get(r.collectionId) ?? 'Unknown' })));
    });
    inputRef.current?.focus();
  }, []);

  const q = query.toLowerCase();
  const filtered = allResults
    .filter(r => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q))
    .slice(0, 20);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIdx]) { onSelect(filtered[activeIdx]); onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl border border-gray-600 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-gray-700">
          <input
            ref={inputRef}
            className="w-full bg-gray-900 border border-gray-600 text-gray-100 rounded px-3 py-2 text-sm outline-none"
            placeholder="Search requests by name or URL…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-gray-500 text-sm px-4 py-3">No results</div>
          ) : (
            filtered.map((r, idx) => (
              <div
                key={r.id}
                onClick={() => { onSelect(r); onClose(); }}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm ${idx === activeIdx ? 'bg-gray-700' : 'hover:bg-gray-700/60'}`}
              >
                <span className={`font-bold font-mono text-xs w-14 shrink-0 ${METHOD_COLORS[r.method] ?? 'text-gray-400'}`}>
                  {r.method}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-100 truncate">{r.name}</div>
                  <div className="text-gray-500 truncate text-xs">{r.url}</div>
                </div>
                <span className="text-gray-600 text-xs shrink-0">{r.collectionName}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
