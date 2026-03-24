import { useState, useEffect } from 'react';
import { db } from '../db/db';
import type { HistoryEntry, RestCollection } from '../types';

interface Props {
  onLoadFromHistory: (entry: HistoryEntry) => void;
}

function statusColor(status: number): string {
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-orange-400';
  if (status >= 300) return 'text-yellow-400';
  if (status >= 200) return 'text-green-400';
  return 'text-gray-400';
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400', POST: 'text-yellow-400', PUT: 'text-blue-400',
  PATCH: 'text-purple-400', DELETE: 'text-red-400', HEAD: 'text-gray-400', OPTIONS: 'text-gray-400',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

type ResponseTab = 'body' | 'headers' | 'assertions';

export default function HistoryBrowser({ onLoadFromHistory }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [collections, setCollections] = useState<RestCollection[]>([]);
  const [filterCollectionId, setFilterCollectionId] = useState('');
  const [filterRequestId, setFilterRequestId] = useState('');
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');

  const load = async () => {
    const [allEntries, allCollections] = await Promise.all([
      db.history.orderBy('executedAt').reverse().toArray(),
      db.collections.toArray(),
    ]);
    setEntries(allEntries);
    setCollections(allCollections);
  };

  useEffect(() => {
    Promise.all([
      db.history.orderBy('executedAt').reverse().toArray(),
      db.collections.toArray(),
    ]).then(([allEntries, allCollections]) => {
      setEntries(allEntries);
      setCollections(allCollections);
    });
  }, []);

  const requestOptions = entries
    .filter(e => !filterCollectionId || e.collectionId === filterCollectionId)
    .reduce<Array<{ id: string; name: string }>>((acc, e) => {
      if (!acc.find(r => r.id === e.requestId)) acc.push({ id: e.requestId, name: e.requestName });
      return acc;
    }, []);

  const filtered = entries.filter(e => {
    if (filterCollectionId && e.collectionId !== filterCollectionId) return false;
    if (filterRequestId && e.requestId !== filterRequestId) return false;
    return true;
  });

  const clearFiltered = async () => {
    if (!confirm(`Delete ${filtered.length} filtered entries?`)) return;
    await db.history.bulkDelete(filtered.map(e => e.id));
    setSelected(null);
    await load();
  };

  const clearAll = async () => {
    if (!confirm('Clear all history?')) return;
    await db.history.clear();
    setEntries([]);
    setSelected(null);
  };

  const handleUseRequest = (entry: HistoryEntry) => {
    onLoadFromHistory(entry);
  };

  return (
    <div className="flex h-full overflow-hidden bg-gray-900">
      {/* Left: filter + list */}
      <div className="flex flex-col w-80 shrink-0 border-r border-gray-700">
        {/* Filter bar */}
        <div className="px-3 py-2 border-b border-gray-700 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Filters</span>
            <div className="flex gap-2">
              {(filterCollectionId || filterRequestId) && filtered.length > 0 && filtered.length < entries.length && (
                <button onClick={clearFiltered} className="text-xs text-orange-400 hover:text-orange-300">
                  Clear filtered ({filtered.length})
                </button>
              )}
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300">
                Clear all
              </button>
            </div>
          </div>
          <select
            value={filterCollectionId}
            onChange={e => { setFilterCollectionId(e.target.value); setFilterRequestId(''); }}
            className="w-full border border-gray-600 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm"
          >
            <option value="">All Collections</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterRequestId}
            onChange={e => setFilterRequestId(e.target.value)}
            disabled={requestOptions.length === 0}
            className="w-full border border-gray-600 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="">All Requests</option>
            {requestOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <span className="text-gray-600 text-xs">{filtered.length} entries</span>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-12 px-4">
              No history yet.<br />Fire a request to see it here.
            </div>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                onClick={() => { setSelected(entry); setResponseTab('body'); }}
                className={`px-3 py-2.5 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                  selected?.id === entry.id ? 'bg-gray-800 border-l-2 border-l-blue-500 pl-[10px]' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold w-14 shrink-0 font-mono ${METHOD_COLORS[entry.method] ?? 'text-gray-400'}`}>
                    {entry.method}
                  </span>
                  <span className={`text-xs font-bold ${statusColor(entry.response.status)}`}>
                    {entry.response.status}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto shrink-0">{entry.response.responseTime}ms</span>
                </div>
                <div className="text-gray-300 text-xs font-mono truncate mb-0.5" title={entry.url}>
                  {entry.url || '(no url)'}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400 truncate">{entry.requestName}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-600 truncate">{entry.collectionName}</span>
                </div>
                <div className="text-gray-600 text-xs mt-0.5">{formatTime(entry.executedAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Detail header */}
            <div className="px-4 py-3 border-b border-gray-700 shrink-0">
              <div className="flex items-start gap-2 mb-2">
                <span className={`text-sm font-bold font-mono shrink-0 ${METHOD_COLORS[selected.method] ?? 'text-gray-400'}`}>
                  {selected.method}
                </span>
                <span className="text-gray-200 text-sm font-mono break-all flex-1 leading-snug">{selected.url}</span>
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className={`font-bold ${statusColor(selected.response.status)}`}>
                  {selected.response.status} {selected.response.statusText}
                </span>
                <span className="text-gray-400">{selected.response.responseTime}ms</span>
                <span className="text-gray-500">{formatTime(selected.executedAt)}</span>
                <span className="text-gray-600">
                  {selected.requestName} · {selected.collectionName}
                </span>
                <button
                  onClick={() => handleUseRequest(selected)}
                  className="ml-auto text-xs bg-blue-700 hover:bg-blue-600 text-white rounded px-3 py-1 font-medium"
                >
                  Open in New Tab ↗
                </button>
              </div>
            </div>

            {/* Response tabs */}
            <div className="flex border-b border-gray-700 px-4 shrink-0">
              {(['body', 'headers', 'assertions'] as ResponseTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setResponseTab(t)}
                  className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${
                    responseTab === t
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >{t}</button>
              ))}
            </div>

            {/* Response content */}
            <div className="flex-1 overflow-y-auto p-4">
              {responseTab === 'body' && (
                <pre className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words">
                  {selected.response.body}
                </pre>
              )}
              {responseTab === 'headers' && (
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(selected.response.headers).map(([k, v]) => (
                      <tr key={k} className="border-b border-gray-800">
                        <td className="py-1 pr-4 text-gray-400 font-mono align-top w-48">{k}</td>
                        <td className="py-1 text-gray-200 font-mono break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {responseTab === 'assertions' && (
                <div className="flex flex-col gap-2">
                  {selected.response.assertionResults.length === 0 ? (
                    <div className="text-gray-500 text-sm">No assertions were defined for this request</div>
                  ) : (
                    selected.response.assertionResults.map(r => (
                      <div key={r.id} className={`flex items-start gap-2 text-sm rounded px-3 py-2 ${r.passed ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                        <span className="font-bold">{r.passed ? '✓' : '✗'}</span>
                        <span>{r.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
            <span className="text-4xl">🕐</span>
            <span className="text-sm">Select an entry to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}
