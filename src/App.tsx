import { useState, useEffect } from 'react';
import { db } from './db/db';
import { executeRequest } from './services/executor';
import { resolveVariables } from './services/variableService';
import type { RestRequest, RestEnvironment, RestResponse } from './types';
import Sidebar from './components/Sidebar';
import RequestEditor from './components/RequestEditor';
import ResponseViewer from './components/ResponseViewer';
import EnvironmentManager from './components/EnvironmentManager';

export default function App() {
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
    loadActiveEnv();
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
        <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-gray-700 bg-gray-900">
          <button
            onClick={() => setShowEnvManager(true)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white border border-gray-600 rounded px-3 py-1 hover:border-gray-400"
          >
            <span className={activeEnvironment ? 'text-green-400' : 'text-gray-500'}>●</span>
            {activeEnvironment ? activeEnvironment.name : 'No Environment'}
          </button>
        </div>

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
    </div>
  );
}
