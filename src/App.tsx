import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/db';
import { executeRequest } from './services/executor';
import { resolveVariables } from './services/variableService';
import type { RestRequest, RestEnvironment, RestResponse, HistoryEntry } from './types';
import Sidebar from './components/Sidebar';
import RequestEditor from './components/RequestEditor';
import ResponseViewer from './components/ResponseViewer';
import EnvironmentManager from './components/EnvironmentManager';
import HistoryBrowser from './components/HistoryBrowser';
import SaveRequestModal from './components/SaveRequestModal';
import QuickOpen from './components/QuickOpen';

const HISTORY_LIMIT = 500;
const HISTORY_TAB_ID = '__history__';

interface RequestTab {
  id: string;
  request: RestRequest;
  response: RestResponse | null;
  isLoading: boolean;
  error: string | null;
  unsaved?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400', POST: 'text-yellow-400', PUT: 'text-blue-400',
  PATCH: 'text-purple-400', DELETE: 'text-red-400', HEAD: 'text-gray-400', OPTIONS: 'text-gray-400',
};

export default function App() {
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<RestEnvironment | null>(null);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingTab, setSavingTab] = useState<string | null>(null);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!activeTabId || activeTabId === HISTORY_TAB_ID) return;
    const el = tabBarRef.current?.querySelector(`[data-tabid="${activeTabId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // ── Tab management ──────────────────────────────────────────────────────────

  const openTab = (req: RestRequest) => {
    setTabs(prev => {
      if (prev.find(t => t.id === req.id)) return prev;
      return [...prev, { id: req.id, request: req, response: null, isLoading: false, error: null }];
    });
    setActiveTabId(req.id);
  };

  const openTabFromHistory = (entry: HistoryEntry) => {
    const tabId = uuidv4();
    const req: RestRequest = {
      id: tabId,
      collectionId: entry.collectionId,
      name: `${entry.requestName} (copy)`,
      method: entry.method,
      url: entry.url,
      headers: entry.headers,
      body: entry.body,
      assertions: entry.assertions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTabs(prev => [...prev, { id: tabId, request: req, response: null, isLoading: false, error: null, unsaved: true }]);
    setActiveTabId(tabId);
  };

  const openScratchTab = () => {
    const tabId = uuidv4();
    const req: RestRequest = {
      id: tabId,
      collectionId: '',
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [],
      body: '',
      assertions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTabs(prev => [...prev, { id: tabId, request: req, response: null, isLoading: false, error: null, unsaved: true }]);
    setActiveTabId(tabId);
  };

  const closeTab = (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    const next = tabs.filter(t => t.id !== tabId);
    setTabs(next);
    if (activeTabId === tabId) {
      if (next.length > 0) {
        setActiveTabId(next[Math.max(0, idx - 1)].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  const updateTab = (tabId: string, patch: Partial<RequestTab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...patch } : t));
  };

  // ── Request actions ─────────────────────────────────────────────────────────

  const handleSave = async (tabId: string, req: RestRequest) => {
    updateTab(tabId, { request: req });
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.unsaved) {
      setSavingTab(tabId);
      setShowSaveModal(true);
      return;
    }
    const { id, ...data } = req;
    await db.requests.update(id, data);
  };

  const handleConfirmSave = async (name: string, collectionId: string) => {
    const tab = tabs.find(t => t.id === savingTab);
    if (!tab) return;
    const newReq: RestRequest = {
      ...tab.request,
      id: uuidv4(),
      collectionId,
      name,
      updatedAt: Date.now(),
    };
    await db.requests.add(newReq);
    setTabs(prev => prev.map(t =>
      t.id === savingTab ? { ...t, id: newReq.id, request: newReq, unsaved: false } : t
    ));
    if (activeTabId === savingTab) setActiveTabId(newReq.id);
    setShowSaveModal(false);
    setSavingTab(null);
  };

  const handleExecute = async (tabId: string, req: RestRequest) => {
    updateTab(tabId, { isLoading: true, error: null, response: null });
    try {
      const resolved = resolveVariables(req, activeEnvironment);
      const res = await executeRequest(resolved);
      updateTab(tabId, { response: res, isLoading: false });

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
      updateTab(tabId, { error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  };

  const switchEnvironment = async (envId: string | null) => {
    const all = await db.environments.toArray();
    for (const env of all) {
      await db.environments.update(env.id, { isActive: env.id === envId });
    }
    await loadActiveEnv();
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeTab && !activeTab.isLoading) handleExecute(activeTab.id, activeTab.request);
      } else if (e.key === 's') {
        e.preventDefault();
        if (activeTab) handleSave(activeTab.id, activeTab.request);
      } else if (e.key === 'w' && !inInput) {
        e.preventDefault();
        if (activeTabId && activeTabId !== HISTORY_TAB_ID) closeTab(activeTabId);
      } else if (e.key === 't' && !inInput) {
        e.preventDefault();
        openScratchTab();
      } else if (e.key === 'p' && !inInput) {
        e.preventDefault();
        setShowQuickOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, activeTabId, tabs]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const savingTabData = tabs.find(t => t.id === savingTab);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col">
        <Sidebar
          onSelectRequest={openTab}
          selectedRequestId={activeTab?.id ?? null}
          openRequestIds={tabs.map(t => t.id)}
        />
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Tab bar */}
        <div className="flex items-stretch bg-gray-950 border-b border-gray-700 min-h-[38px]">
          <div ref={tabBarRef} className="flex overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  data-tabid={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-0 text-sm cursor-pointer shrink-0 select-none border-r border-gray-700 group transition-colors min-w-0 max-w-[200px] ${
                    isActive
                      ? 'bg-gray-900 text-white border-t-2 border-t-blue-500'
                      : 'bg-gray-950 text-gray-400 hover:bg-gray-900/60 hover:text-gray-200 border-t-2 border-t-transparent'
                  }`}
                >
                  <span className={`text-xs font-bold font-mono shrink-0 ${METHOD_COLORS[tab.request.method] ?? 'text-gray-400'}`}>
                    {tab.request.method}
                  </span>
                  <span className="truncate flex-1 text-xs">{tab.request.name}</span>
                  {tab.unsaved && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved (from history)" />
                  )}
                  {tab.isLoading && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                    className="shrink-0 text-gray-600 hover:text-white ml-0.5 leading-none text-base opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Close tab"
                  >×</button>
                </div>
              );
            })}
          </div>

          {/* History tab — pinned right */}
          <div
            onClick={() => setActiveTabId(HISTORY_TAB_ID)}
            className={`flex items-center gap-1.5 px-4 text-sm cursor-pointer select-none shrink-0 border-l border-gray-700 transition-colors ${
              activeTabId === HISTORY_TAB_ID
                ? 'bg-gray-900 text-white border-t-2 border-t-blue-500'
                : 'bg-gray-950 text-gray-400 hover:bg-gray-900/60 hover:text-gray-200 border-t-2 border-t-transparent'
            }`}
          >
            🕐 <span className="text-xs">History</span>
          </div>

          {/* Environment selector */}
          <div className="flex items-center px-3 border-l border-gray-700 shrink-0">
            <button
              onClick={() => setShowEnvManager(true)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 rounded px-2 py-1 hover:border-gray-400 whitespace-nowrap"
            >
              <span className={activeEnvironment ? 'text-green-400' : 'text-gray-500'}>●</span>
              {activeEnvironment ? activeEnvironment.name : 'No Env'}
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTabId === HISTORY_TAB_ID ? (
            <HistoryBrowser
              onLoadFromHistory={openTabFromHistory}
            />
          ) : activeTab ? (
            <div className="flex h-full overflow-hidden">
              <div className="flex-1 overflow-hidden border-r border-gray-700">
                <RequestEditor
                  request={activeTab.request}
                  onSave={(req) => handleSave(activeTab.id, req)}
                  onExecute={(req) => handleExecute(activeTab.id, req)}
                  isLoading={activeTab.isLoading}
                  unsaved={activeTab.unsaved}
                  onSaveUnsaved={() => { setSavingTab(activeTab.id); setShowSaveModal(true); }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <ResponseViewer
                  response={activeTab.response}
                  isLoading={activeTab.isLoading}
                  error={activeTab.error}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-600 gap-3">
              <span className="text-5xl">⚡</span>
              <p className="text-sm">Open a request from the sidebar to get started</p>
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

      {showSaveModal && savingTabData && (
        <SaveRequestModal
          requestName={savingTabData.request.name}
          onConfirm={handleConfirmSave}
          onCancel={() => { setShowSaveModal(false); setSavingTab(null); }}
        />
      )}

      {showQuickOpen && (
        <QuickOpen
          onSelect={openTab}
          onClose={() => setShowQuickOpen(false)}
        />
      )}
    </div>
  );
}
