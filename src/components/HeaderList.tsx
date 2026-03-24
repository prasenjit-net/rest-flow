import { v4 as uuidv4 } from 'uuid';
import type { Header } from '../types';

interface Props {
  headers: Header[];
  onChange: (headers: Header[]) => void;
}

export default function HeaderList({ headers, onChange }: Props) {
  const add = () =>
    onChange([...headers, { id: uuidv4(), key: '', value: '', enabled: true }]);

  const update = (id: string, field: keyof Header, value: string | boolean) =>
    onChange(headers.map(h => (h.id === id ? { ...h, [field]: value } : h)));

  const remove = (id: string) => onChange(headers.filter(h => h.id !== id));

  return (
    <div className="flex flex-col gap-1">
      {headers.map(h => (
        <div key={h.id} className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={h.enabled}
            onChange={e => update(h.id, 'enabled', e.target.checked)}
            className="accent-blue-500"
          />
          <input
            className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
            placeholder="Key"
            value={h.key}
            onChange={e => update(h.id, 'key', e.target.value)}
          />
          <input
            className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
            placeholder="Value"
            value={h.value}
            onChange={e => update(h.id, 'value', e.target.value)}
          />
          <button
            onClick={() => remove(h.id)}
            className="text-gray-400 hover:text-red-400 text-lg leading-none px-1"
            title="Remove"
          >×</button>
        </div>
      ))}
      <button
        onClick={add}
        className="self-start text-blue-400 hover:text-blue-300 text-sm mt-1"
      >+ Add Header</button>
    </div>
  );
}
