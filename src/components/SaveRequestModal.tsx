import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import type { RestCollection } from '../types';

interface Props {
  requestName: string;
  onConfirm: (name: string, collectionId: string) => void;
  onCancel: () => void;
}

export default function SaveRequestModal({ requestName, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(requestName);
  const [collections, setCollections] = useState<RestCollection[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isNew, setIsNew] = useState(false);
  const [newColName, setNewColName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.collections.toArray().then(cols => {
      setCollections(cols);
      if (cols.length > 0) setSelectedId(cols[0].id);
    });
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSelectChange = (val: string) => {
    if (val === '__new__') {
      setIsNew(true);
      setSelectedId('__new__');
    } else {
      setIsNew(false);
      setSelectedId(val);
    }
  };

  const isValid = isNew ? newColName.trim() !== '' : selectedId !== '' && selectedId !== '__new__';

  const handleConfirm = async () => {
    if (!isValid) return;
    let colId = selectedId;
    if (isNew) {
      colId = uuidv4();
      await db.collections.add({ id: colId, name: newColName.trim(), createdAt: Date.now() });
    }
    onConfirm(name.trim() || requestName, colId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-600 w-full max-w-md p-6 flex flex-col gap-4">
        <h2 className="text-white font-semibold text-lg">Save Request to Collection</h2>

        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-sm">Request Name</label>
          <input
            ref={nameInputRef}
            className="border border-gray-600 bg-gray-900 text-gray-100 rounded px-3 py-1.5 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-sm">Collection</label>
          <select
            value={selectedId}
            onChange={e => handleSelectChange(e.target.value)}
            className="border border-gray-600 bg-gray-900 text-gray-100 rounded px-3 py-1.5 text-sm"
          >
            <option value="__new__">＋ New collection</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {isNew && (
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-sm">New Collection Name</label>
            <input
              autoFocus
              className="border border-gray-600 bg-gray-900 text-gray-100 rounded px-3 py-1.5 text-sm"
              placeholder="My Collection"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && isValid) handleConfirm(); }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-1.5 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
