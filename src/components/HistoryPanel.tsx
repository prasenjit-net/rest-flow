import { useState, useEffect } from 'react';
import { db } from '../db/db';
import type { HistoryEntry, RestRequest, RestCollection } from '../types';

interface Props {
  onClose: () => void;
  onLoadRequest: (req: RestRequest) => void;
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
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type ResponseTab = 'body' | 'headers' | 'assertions';

export default function HistoryPanel({ onClose, onLoadRequest }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [collections, setCollections] = useState<RestCollection[]>([]);
  const [filterCollectionId, setFilterCollectionId] = useState<string>('');
  const [filterRequestId, setFilterRequestId] = useState<string>('');
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
    db.history.orderBy('executedAt').reverse().toArray().then(allEntries => {
      setEntries(allEntries);
    });
    db.collections.toArray().then(cols => setCollections(cols));
  }, []);

  // Unique requests within selected collection filter (for request filter dropdown)
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
    const ids = filtered.map(e => e.id);
    await db.history.bulkDelete(ids);
    setSelected(null);
    await load();
  };

  const clearAll = async () => {
    if (!confirm('Clear all history?')) return;
    await db.history.clear();
    setEntries([]);
    setSelected(null);
  };

  const handleLoadRequest = (entry: HistoryEntry) => {
    const req: RestRequest = {
      id: entry.requestId,
      collectionId: entry.collectionId,
      name: entry.requestName,
      method: entry.method,
      url: entry.url,
      headers: entry.headers,
      body: entry.body,
      assertions: entry.assertions,
      createdAt: entry.executedAt,
      updatedAt: entry.executedAt,
    };
    onLoadRequest(req);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-[900px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <h2 className="text-white font-semibold text-base">Request History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-1"
            >Clear All</button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-2">×</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 shrink-0">
          <select
            value={filterCollectionId}
            onChange={e => { setFilterCollectionId(e.target.value); setFilterRequestId(''); }}
            className="border border-gray-600 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm"
          >
            <option value="">All Collections</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filterRequestId}
            onChange={e => setFilterRequestId(e.target.value)}
            className="border border-gray-600 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm"
            disabled={requestOptions.length === 0}
          >
            <option value="">All Requests</option>
            {requestOptions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <span className="text-gray-500 text-xs ml-auto">{filtered.length} entries</span>

          {(filterCollectionId || filterRequestId) && filtered.length > 0 && (
            <button
              onClick={clearFiltered}
              className="text-xs text-red-400 hover:text-red-300"
            >Clear filtered</button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Entry list */}
          <div className="w-80 shrink-0 border-r border-gray-700 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8 px-4">No history entries</div>
            ) : (
              filtered.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => { setSelected(entry); setResponseTab('body'); }}
                  className={`px-3 py-2.5 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${selected?.id === entry.id ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold w-14 shrink-0 ${METHOD_COLORS[entry.method] ?? 'text-gray-400'}`}>
                      {entry.method}
                    </span>
                    <span className={`text-xs font-bold ${statusColor(entry.response.status)}`}>
                      {entry.response.status}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto shrink-0">
                      {entry.response.responseTime}ms
                    </span>
                  </div>
                  <div className="text-gray-300 text-xs truncate mb-0.5" title={entry.url}>{entry.url || '(no url)'}</div>
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <span className="truncate">{entry.requestName}</span>
                    <span>·</span>
                    <span className="truncate text-gray-600">{entry.collectionName}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">{formatTime(entry.executedAt)}</div>
                </div>
              ))
            )}
          </div>

          {/* Detail panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                {/* Detail header */}
                <div className="px-4 py-2.5 border-b border-gray-700 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${METHOD_COLORS[selected.method] ?? 'text-gray-400'}`}>
                      {selected.method}
                    </span>
                    <span className="text-gray-200 text-sm font-mono truncate flex-1">{selected.url}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`font-bold ${statusColor(selected.response.status)}`}>
                      {selected.response.status} {selected.response.statusText}
                    </span>
                    <span className="text-gray-400">{selected.response.responseTime}ms</span>
                    <span className="text-gray-500">{formatTime(selected.executedAt)}</span>
                    <button
                      onClick={() => handleLoadRequest(selected)}
                      className="ml-auto text-xs bg-blue-700 hover:bg-blue-600 text-white rounded px-2 py-0.5"
                    >Use Request</button>
                  </div>
                </div>

                {/* Response tabs */}
                <div className="flex border-b border-gray-700 px-4 shrink-0">
                  {(['body', 'headers', 'assertions'] as ResponseTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setResponseTab(t)}
                      className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${responseTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
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
                            <td className="py-1 pr-4 text-gray-400 font-mono align-top">{k}</td>
                            <td className="py-1 text-gray-200 font-mono break-all">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {responseTab === 'assertions' && (
                    <div className="flex flex-col gap-2">
                      {selected.response.assertionResults.length === 0 ? (
                        <div className="text-gray-500 text-sm">No assertions were defined</div>
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
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                Select an entry to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
