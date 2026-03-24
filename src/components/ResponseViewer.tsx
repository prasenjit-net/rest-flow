import { useState } from 'react';
import type { RestResponse } from '../types';

interface Props {
  response: RestResponse | null;
  isLoading: boolean;
  error: string | null;
}

type Tab = 'body' | 'headers' | 'assertions';

function statusColor(status: number): string {
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-orange-400';
  if (status >= 300) return 'text-yellow-400';
  if (status >= 200) return 'text-green-400';
  return 'text-gray-400';
}

export default function ResponseViewer({ response, isLoading, error }: Props) {
  const [tab, setTab] = useState<Tab>('body');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <span className="animate-pulse">Sending request…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm px-4 text-center">
        {error}
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Hit Send to get a response
      </div>
    );
  }

  const passed = response.assertionResults.filter(r => r.passed).length;
  const total = response.assertionResults.length;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700 text-sm">
        <span className={`font-bold ${statusColor(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-gray-400">{response.responseTime}ms</span>
        {total > 0 && (
          <span className={passed === total ? 'text-green-400' : 'text-red-400'}>
            {passed}/{total} assertions
          </span>
        )}
      </div>

      <div className="flex border-b border-gray-700 px-4">
        {(['body', 'headers', 'assertions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'body' && (
          <pre className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words">
            {response.body}
          </pre>
        )}
        {tab === 'headers' && (
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-800">
                  <td className="py-1 pr-4 text-gray-400 font-mono align-top">{k}</td>
                  <td className="py-1 text-gray-200 font-mono break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'assertions' && (
          <div className="flex flex-col gap-2">
            {response.assertionResults.length === 0 ? (
              <div className="text-gray-500 text-sm">No assertions defined</div>
            ) : (
              response.assertionResults.map(r => (
                <div key={r.id} className={`flex items-start gap-2 text-sm rounded px-3 py-2 ${r.passed ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                  <span className="font-bold">{r.passed ? '✓' : '✗'}</span>
                  <span>{r.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
