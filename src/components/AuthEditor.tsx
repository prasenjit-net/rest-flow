import type { AuthConfig, AuthType } from '../types';

interface Props {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}

const INPUT_CLASS = 'border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1.5 text-sm flex-1';
const LABEL_CLASS = 'text-gray-400 text-sm w-32 shrink-0';

export default function AuthEditor({ auth, onChange }: Props) {
  const setType = (type: AuthType) => onChange({ ...auth, type });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={LABEL_CLASS}>Auth Type</span>
        <select
          value={auth.type}
          onChange={e => setType(e.target.value as AuthType)}
          className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1.5 text-sm"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div className="flex items-center gap-3">
          <span className={LABEL_CLASS}>Token</span>
          <input
            type="password"
            className={INPUT_CLASS}
            placeholder="Bearer token"
            value={auth.token ?? ''}
            onChange={e => onChange({ ...auth, token: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="flex items-center gap-3">
            <span className={LABEL_CLASS}>Username</span>
            <input
              className={INPUT_CLASS}
              placeholder="Username"
              value={auth.username ?? ''}
              onChange={e => onChange({ ...auth, username: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className={LABEL_CLASS}>Password</span>
            <input
              type="password"
              className={INPUT_CLASS}
              placeholder="Password"
              value={auth.password ?? ''}
              onChange={e => onChange({ ...auth, password: e.target.value })}
            />
          </div>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className="flex items-center gap-3">
            <span className={LABEL_CLASS}>Key Name</span>
            <input
              className={INPUT_CLASS}
              placeholder="X-API-Key"
              value={auth.apiKeyName ?? ''}
              onChange={e => onChange({ ...auth, apiKeyName: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className={LABEL_CLASS}>Key Value</span>
            <input
              type="password"
              className={INPUT_CLASS}
              placeholder="API key value"
              value={auth.apiKeyValue ?? ''}
              onChange={e => onChange({ ...auth, apiKeyValue: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className={LABEL_CLASS}>Add to</span>
            <select
              value={auth.apiKeyIn ?? 'header'}
              onChange={e => onChange({ ...auth, apiKeyIn: e.target.value as 'header' | 'query' })}
              className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1.5 text-sm"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </>
      )}

      {auth.type === 'none' && (
        <p className="text-gray-500 text-sm">No authentication will be sent with this request.</p>
      )}
    </div>
  );
}
