import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/db';
import { executeRequest } from './services/executor';
import { resolveVariables } from './services/variableService';
import type { RestRequest, RestEnvironment, RestResponse } from './types';
import Sidebar from './components/Sidebar';
import RequestEditor from './components/RequestEditor';
import ResponseViewer from './components/ResponseViewer';
import EnvironmentManager from './components/EnvironmentManager';
import HistoryPanel from './components/HistoryPanel';

const HISTORY_LIMIT = 500;

export default function App() {
  const [selectedRequest, setSelectedRequest] = useState<RestRequest | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<RestEnvironment | null>(null);
  const [response, setResponse] = useState<RestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadActiveEnv = async () => {
    const env = await db.environments.filter(e => e.isActive).first();
    setActiveEnvironment(env ?? null);
  };

  useEffect(() => {
    db.environments.filter(e => e.isActive).first().then(env => {
      setActiveEnvironment(env ?? null);
    });
    const id = setInterval(loadActiveEnv, 3000);
    return () => clearInterval(id);
  }, []);

  const handleSelectRequest = (req: RestRequest) => {
    setSelectedRequest(req);
    setResponse(null);
    setError(null);
  };

  const handleSave = async (req: RestRequest) => {
    setSelectedRequest(req);
    const { id, ...data } = req;
    await db.requests.update(id, data);
  };

  const handleExecute = async (req: RestRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    try {
      const resolved = resolveVariables(req, activeEnvironment);
      const res = await executeRequest(resolved);
      setResponse(res);

      // Save to history
      const collection = await db.collections.get(req.collectionId);
      await db.history.add({
        id: uuidv4(),
        requestId: req.id,
        collectionId: req.collectionId,
        requestName: req.name,
        collectionName: collection?.name ?? 'Unknown',
        method: resolved.method,
        url: resolved.url,
        headers: resolved.headers,
        body: resolved.body,
        assertions: resolved.assertions,
        response: res,
        executedAt: Date.now(),
      });

      // Prune history to latest HISTORY_LIMIT entries
      const count = await db.history.count();
      if (count > HISTORY_LIMIT) {
        const oldest = await db.history
          .orderBy('executedAt')
          .limit(count - HISTORY_LIMIT)
          .primaryKeys();
        await db.history.bulkDelete(oldest as string[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const switchEnvironment = async (envId: string | null) => {
    const all = await db.environments.toArray();
    for (const env of all) {
      await db.environments.update(env.id, { isActive: env.id === envId });
    }
    await loadActiveEnv();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <div className="w-64 shrink-0 flex flex-col">
        <Sidebar
          onSelectRequest={handleSelectRequest}
          selectedRequestId={selectedRequest?.id ?? null}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-gray-600 rounded px-3 py-1 hover:border-gray-400"
          >
            <span>🕐</span> History
          </button>
          <button
            onClick={() => setShowEnvManager(true)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-gray-600 rounded px-3 py-1 hover:border-gray-400"
          >
            <span className={activeEnvironment ? 'text-green-400' : 'text-gray-500'}>●</span>
            {activeEnvironment ? activeEnvironment.name : 'No Environment'}
          </button>
        </div>

        {/* Editor + Response split */}
        <div className="flex-1 flex overflow-hidden">
          {selectedRequest ? (
            <>
              <div className="flex-1 overflow-hidden border-r border-gray-700">
                <RequestEditor
                  request={selectedRequest}
                  onSave={handleSave}
                  onExecute={handleExecute}
                  isLoading={isLoading}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <ResponseViewer
                  response={response}
                  isLoading={isLoading}
                  error={error}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select or create a request to get started
            </div>
          )}
        </div>
      </div>

      {showEnvManager && (
        <EnvironmentManager
          onClose={() => setShowEnvManager(false)}
          activeEnvironmentId={activeEnvironment?.id ?? null}
          onSwitch={switchEnvironment}
        />
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onLoadRequest={(req) => {
            handleSelectRequest(req);
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
}
