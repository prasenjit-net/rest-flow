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
import HistoryBrowser from './components/HistoryBrowser';

const HISTORY_LIMIT = 500;

type MainTab = 'editor' | 'history';

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>('editor');
  const [selectedRequest, setSelectedRequest] = useState<RestRequest | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<RestEnvironment | null>(null);
  const [response, setResponse] = useState<RestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEnvManager, setShowEnvManager] = useState(false);

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
    setMainTab('editor');
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
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col">
        <Sidebar
          onSelectRequest={handleSelectRequest}
          selectedRequestId={selectedRequest?.id ?? null}
        />
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Tab bar + environment */}
        <div className="flex items-center border-b border-gray-700 bg-gray-900 px-2">
          {/* Main tabs */}
          <div className="flex items-end h-full gap-0.5 pt-1">
            <TabButton
              active={mainTab === 'editor'}
              onClick={() => setMainTab('editor')}
              icon="✏️"
              label={selectedRequest ? selectedRequest.name : 'Editor'}
            />
            <TabButton
              active={mainTab === 'history'}
              onClick={() => setMainTab('history')}
              icon="🕐"
              label="History"
            />
          </div>

          {/* Environment selector pushed to right */}
          <div className="ml-auto pr-2">
            <button
              onClick={() => setShowEnvManager(true)}
              className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-gray-600 rounded px-3 py-1 hover:border-gray-400 my-1.5"
            >
              <span className={activeEnvironment ? 'text-green-400' : 'text-gray-500'}>●</span>
              {activeEnvironment ? activeEnvironment.name : 'No Environment'}
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {mainTab === 'editor' && (
            <div className="flex h-full overflow-hidden">
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
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
                  <span className="text-4xl">✏️</span>
                  <span className="text-sm">Select or create a request in the sidebar</span>
                </div>
              )}
            </div>
          )}

          {mainTab === 'history' && (
            <HistoryBrowser
              onLoadRequest={(req) => {
                handleSelectRequest(req);
              }}
            />
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
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t border-t border-x transition-colors max-w-[180px] ${
        active
          ? 'bg-gray-900 border-gray-700 text-white border-b-gray-900'
          : 'bg-gray-950 border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
      }`}
      style={active ? { marginBottom: '-1px' } : {}}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
