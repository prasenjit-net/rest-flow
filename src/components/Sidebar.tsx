/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import type { RestCollection, RestRequest } from '../types';

interface Props {
  onSelectRequest: (request: RestRequest) => void;
  selectedRequestId: string | null;
}

const EXPORT_VERSION = '1.0';

function makeCollection(name: string): RestCollection {
  const now = Date.now();
  return { id: uuidv4(), name, createdAt: now };
}

function makeRequest(collectionId: string): RestRequest {
  const now = Date.now();
  return {
    id: uuidv4(),
    collectionId,
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    assertions: [],
    createdAt: now,
    updatedAt: now,
  };
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
};

export default function Sidebar({ onSelectRequest, selectedRequestId }: Props) {
  const [collections, setCollections] = useState<RestCollection[]>([]);
  const [requests, setRequests] = useState<RestRequest[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [cols, reqs] = await Promise.all([
      db.collections.orderBy('createdAt').toArray(),
      db.requests.orderBy('updatedAt').reverse().toArray(),
    ]);
    setCollections(cols);
    setRequests(reqs);
  };

  useEffect(() => {
    // Inline initial fetch so setState runs in .then() callback, not synchronously in effect
    Promise.all([
      db.collections.orderBy('createdAt').toArray(),
      db.requests.orderBy('updatedAt').reverse().toArray(),
    ]).then(([cols, reqs]) => {
      setCollections(cols);
      setRequests(reqs);
    });
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  const createCollection = async () => {
    const col = makeCollection('New Collection');
    await db.collections.add(col);
    setExpanded(prev => new Set([...prev, col.id]));
    await load();
  };

  const deleteCollection = async (id: string) => {
    if (!confirm('Delete collection and all its requests?')) return;
    await db.collections.delete(id);
    await db.requests.where('collectionId').equals(id).delete();
    await load();
  };

  const renameCollection = async (col: RestCollection) => {
    const name = prompt('Collection name:', col.name);
    if (name && name !== col.name) {
      await db.collections.update(col.id, { name });
      await load();
    }
  };

  const createRequest = async (collectionId: string) => {
    const req = makeRequest(collectionId);
    await db.requests.add(req);
    onSelectRequest(req);
    await load();
  };

  const deleteRequest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.requests.delete(id);
    await load();
  };

  const exportCollection = async (col: RestCollection) => {
    const reqs = await db.requests.where('collectionId').equals(col.id).toArray();
    const payload = { version: EXPORT_VERSION, collection: col, requests: reqs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${col.name}.restflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCollection = () => fileInputRef.current?.click();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as any;
      const { collection, requests: reqs } = payload;
      const newColId = uuidv4();
      await db.collections.add({ ...collection, id: newColId, name: `${collection.name} (imported)` });
      for (const req of reqs) {
        await db.requests.add({ ...req, id: uuidv4(), collectionId: newColId });
      }
      await load();
    } catch {
      alert('Invalid .restflow.json file');
    }
    e.target.value = '';
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-700 select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-white font-bold text-sm tracking-wide">Restflow</span>
        <div className="flex gap-2">
          <button onClick={importCollection} title="Import" className="text-gray-400 hover:text-white text-xs px-1">⬆</button>
          <button onClick={createCollection} title="New Collection" className="text-gray-400 hover:text-white text-xs px-1">+</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {collections.length === 0 && (
          <div className="text-gray-600 text-xs px-3 py-4 text-center">No collections yet.<br />Click + to create one.</div>
        )}
        {collections.map(col => {
          const colRequests = requests.filter(r => r.collectionId === col.id);
          const isOpen = expanded.has(col.id);
          return (
            <div key={col.id}>
              <div
                className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-gray-800 group"
                onClick={() => toggleExpand(col.id)}
              >
                <span className="text-gray-400 text-xs w-3">{isOpen ? '▾' : '▸'}</span>
                <span className="flex-1 text-gray-200 text-sm truncate">{col.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); createRequest(col.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-sm px-1"
                  title="New request"
                >+</button>
                <button
                  onClick={e => { e.stopPropagation(); exportCollection(col); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-xs px-1"
                  title="Export"
                >⬇</button>
                <button
                  onClick={e => { e.stopPropagation(); renameCollection(col); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-xs px-1"
                  title="Rename"
                >✎</button>
                <button
                  onClick={e => { e.stopPropagation(); deleteCollection(col.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-sm px-1"
                  title="Delete"
                >×</button>
              </div>
              {isOpen && colRequests.map(req => (
                <div
                  key={req.id}
                  className={`flex items-center gap-2 pl-6 pr-2 py-1.5 cursor-pointer hover:bg-gray-800 group ${selectedRequestId === req.id ? 'bg-gray-800' : ''}`}
                  onClick={() => onSelectRequest(req)}
                >
                  <span className={`text-xs font-bold w-14 shrink-0 ${METHOD_COLORS[req.method] ?? 'text-gray-400'}`}>{req.method}</span>
                  <span className="flex-1 text-gray-300 text-sm truncate">{req.name}</span>
                  <button
                    onClick={e => deleteRequest(req.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-sm px-1"
                    title="Delete"
                  >×</button>
                </div>
              ))}
              {isOpen && colRequests.length === 0 && (
                <div className="pl-8 py-1 text-gray-600 text-xs">No requests</div>
              )}
            </div>
          );
        })}
      </div>

      <input ref={fileInputRef} type="file" accept=".json,.restflow.json" className="hidden" onChange={handleImport} />
    </div>
  );
}
