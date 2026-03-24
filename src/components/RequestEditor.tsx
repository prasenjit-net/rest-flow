import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { RestRequest, HttpMethod, BodyFormat, FormParam, AuthConfig } from '../types';
import HeaderList from './HeaderList';
import AssertionList from './AssertionList';
import AuthEditor from './AuthEditor';

interface Props {
  request: RestRequest;
  onSave: (request: RestRequest) => void;
  onExecute: (request: RestRequest) => void;
  isLoading: boolean;
  unsaved?: boolean;
  onSaveUnsaved?: () => void;
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

type Tab = 'headers' | 'body' | 'assertions' | 'auth';

const FORMAT_LABELS: Record<BodyFormat, string> = {
  raw: 'Raw',
  json: 'JSON',
  form: 'Form Data',
  urlencoded: 'URL-encoded',
};

const CONTENT_TYPE_MAP: Partial<Record<BodyFormat, string>> = {
  json: 'application/json',
  form: 'multipart/form-data',
  urlencoded: 'application/x-www-form-urlencoded',
};

export default function RequestEditor({ request, onSave, onExecute, isLoading, unsaved, onSaveUnsaved }: Props) {
  const [tab, setTab] = useState<Tab>('headers');
  const [jsonError, setJsonError] = useState('');

  const update = (patch: Partial<RestRequest>) => {
    // eslint-disable-next-line react-hooks/purity
    onSave({ ...request, ...patch, updatedAt: Date.now() });
  };

  const handleFormatChange = (format: BodyFormat) => {
    const ctMime = CONTENT_TYPE_MAP[format];
    let headers = [...request.headers];
    if (ctMime) {
      const existing = headers.findIndex(h => h.key.toLowerCase() === 'content-type');
      if (existing >= 0) {
        headers = headers.map((h, i) => i === existing ? { ...h, value: ctMime, enabled: true } : h);
      } else {
        headers = [...headers, { id: uuidv4(), key: 'Content-Type', value: ctMime, enabled: true }];
      }
    }
    update({ bodyFormat: format, headers });
  };

  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(request.body);
      update({ body: JSON.stringify(parsed, null, 2) });
      setJsonError('');
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  const updateFormParam = (params: FormParam[]) => update({ formParams: params });

  const addFormParam = () =>
    updateFormParam([...(request.formParams ?? []), { id: uuidv4(), key: '', value: '', enabled: true }]);

  const editFormParam = (id: string, field: keyof FormParam, value: string | boolean) =>
    updateFormParam((request.formParams ?? []).map(p => p.id === id ? { ...p, [field]: value } : p));

  const removeFormParam = (id: string) =>
    updateFormParam((request.formParams ?? []).filter(p => p.id !== id));

  const currentFormat: BodyFormat = request.bodyFormat ?? 'raw';
  const showPrettify = currentFormat === 'raw' || currentFormat === 'json';
  const showParamTable = currentFormat === 'form' || currentFormat === 'urlencoded';
  const authActive = request.auth?.type && request.auth.type !== 'none';

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
        {unsaved && (
          <button
            onClick={() => onSaveUnsaved?.()}
            className="bg-amber-600 hover:bg-amber-500 text-white rounded text-sm font-semibold px-3 py-1.5"
            title="Save to collection"
          >
            💾 Save
          </button>
        )}
        <button
          onClick={() => onExecute(request)}
          disabled={isLoading}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-semibold"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="flex border-b border-gray-700 px-4">
        {(['headers', 'body', 'assertions', 'auth'] as Tab[]).map(t => (
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
            {t === 'auth' && authActive && (
              <span className="ml-1 text-xs bg-amber-700 text-amber-200 rounded px-1">on</span>
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
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Format:</span>
              <select
                value={currentFormat}
                onChange={e => handleFormatChange(e.target.value as BodyFormat)}
                className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
              >
                {(Object.keys(FORMAT_LABELS) as BodyFormat[]).map(f => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
              {showPrettify && (
                <button
                  onClick={handlePrettify}
                  className="text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-1 text-sm"
                  title="Prettify JSON"
                >
                  {'{ }'} Prettify
                </button>
              )}
              {jsonError && <span className="text-red-400 text-xs">{jsonError}</span>}
            </div>
            {showParamTable ? (
              <div className="flex flex-col gap-1">
                {(request.formParams ?? []).map(p => (
                  <div key={p.id} className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={e => editFormParam(p.id, 'enabled', e.target.checked)}
                      className="accent-blue-500"
                    />
                    <input
                      className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
                      placeholder="Key"
                      value={p.key}
                      onChange={e => editFormParam(p.id, 'key', e.target.value)}
                    />
                    <input
                      className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
                      placeholder="Value"
                      value={p.value}
                      onChange={e => editFormParam(p.id, 'value', e.target.value)}
                    />
                    <button
                      onClick={() => removeFormParam(p.id)}
                      className="text-gray-400 hover:text-red-400 text-lg leading-none px-1"
                      title="Remove"
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={addFormParam}
                  className="self-start text-blue-400 hover:text-blue-300 text-sm mt-1"
                >+ Add Param</button>
              </div>
            ) : (
              <textarea
                className="flex-1 min-h-[200px] border border-gray-600 bg-gray-800 text-gray-100 rounded px-3 py-2 text-sm font-mono resize-none"
                placeholder='{"key": "value"}'
                value={request.body}
                onChange={e => { setJsonError(''); update({ body: e.target.value }); }}
              />
            )}
          </div>
        )}
        {tab === 'assertions' && (
          <AssertionList
            assertions={request.assertions}
            onChange={assertions => update({ assertions })}
          />
        )}
        {tab === 'auth' && (
          <AuthEditor
            auth={request.auth ?? { type: 'none' }}
            onChange={(auth: AuthConfig) => update({ auth })}
          />
        )}
      </div>
    </div>
  );
}

