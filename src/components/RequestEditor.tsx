import { useState } from 'react';
import type { RestRequest, HttpMethod } from '../types';
import HeaderList from './HeaderList';
import AssertionList from './AssertionList';

interface Props {
  request: RestRequest;
  onSave: (request: RestRequest) => void;
  onExecute: (request: RestRequest) => void;
  isLoading: boolean;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
};

type Tab = 'headers' | 'body' | 'assertions';

export default function RequestEditor({ request, onSave, onExecute, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('headers');

  const update = (patch: Partial<RestRequest>) => {
    onSave({ ...request, ...patch, updatedAt: Date.now() });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="px-4 pt-3 pb-2 border-b border-gray-700">
        <input
          className="w-full bg-transparent text-white font-semibold text-base outline-none placeholder-gray-500"
          placeholder="Request name"
          value={request.name}
          onChange={e => update({ name: e.target.value })}
        />
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-gray-700">
        <select
          value={request.method}
          onChange={e => update({ method: e.target.value as HttpMethod })}
          className={`border border-gray-600 bg-gray-800 rounded px-2 py-1.5 text-sm font-mono font-bold ${METHOD_COLORS[request.method]}`}
        >
          {METHODS.map(m => (
            <option key={m} value={m} className="text-gray-100">{m}</option>
          ))}
        </select>
        <input
          className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-3 py-1.5 text-sm font-mono"
          placeholder="https://api.example.com/endpoint"
          value={request.url}
          onChange={e => update({ url: e.target.value })}
        />
        <button
          onClick={() => onExecute(request)}
          disabled={isLoading}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-semibold"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="flex border-b border-gray-700 px-4">
        {(['headers', 'body', 'assertions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t}
            {t === 'headers' && request.headers.filter(h => h.enabled).length > 0 && (
              <span className="ml-1 text-xs bg-gray-700 text-gray-300 rounded px-1">
                {request.headers.filter(h => h.enabled).length}
              </span>
            )}
            {t === 'assertions' && request.assertions.filter(a => a.enabled).length > 0 && (
              <span className="ml-1 text-xs bg-gray-700 text-gray-300 rounded px-1">
                {request.assertions.filter(a => a.enabled).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'headers' && (
          <HeaderList
            headers={request.headers}
            onChange={headers => update({ headers })}
          />
        )}
        {tab === 'body' && (
          <textarea
            className="w-full h-full min-h-[200px] border border-gray-600 bg-gray-800 text-gray-100 rounded px-3 py-2 text-sm font-mono resize-none"
            placeholder='{"key": "value"}'
            value={request.body}
            onChange={e => update({ body: e.target.value })}
          />
        )}
        {tab === 'assertions' && (
          <AssertionList
            assertions={request.assertions}
            onChange={assertions => update({ assertions })}
          />
        )}
      </div>
    </div>
  );
}
