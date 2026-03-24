import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import type { RestEnvironment, EnvVariable } from '../types';

function makeEnvironment(): RestEnvironment {
  return { id: uuidv4(), name: 'New Environment', variables: [], isActive: false, createdAt: Date.now() };
}

interface Props {
  onClose: () => void;
  activeEnvironmentId: string | null;
  onSwitch: (envId: string | null) => void;
}

export default function EnvironmentManager({ onClose, activeEnvironmentId, onSwitch }: Props) {
  const [environments, setEnvironments] = useState<RestEnvironment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    const envs = await db.environments.toArray();
    setEnvironments(envs);
    return envs;
  };

  useEffect(() => {
    db.environments.toArray().then(envs => {
      setEnvironments(envs);
      setSelectedId(prev => prev ?? (envs.length > 0 ? envs[0].id : null));
    });
  }, []);

  const selected = environments.find(e => e.id === selectedId) ?? null;

  const createEnv = async () => {
    const env = makeEnvironment();
    await db.environments.add(env);
    await load();
    setSelectedId(env.id);
  };

  const deleteEnv = async (id: string) => {
    await db.environments.delete(id);
    if (activeEnvironmentId === id) onSwitch(null);
    setSelectedId(null);
    await load();
  };

  const updateSelected = async (updated: RestEnvironment) => {
    const { id, ...data } = updated;
    await db.environments.update(id, data);
    setEnvironments(prev => prev.map(e => (e.id === id ? updated : e)));
  };

  const updateName = (name: string) => {
    if (!selected) return;
    updateSelected({ ...selected, name });
  };

  const updateVars = (variables: EnvVariable[]) => {
    if (!selected) return;
    updateSelected({ ...selected, variables });
  };

  const addVar = () => {
    if (!selected) return;
    updateVars([...selected.variables, { id: uuidv4(), key: '', value: '', enabled: true }]);
  };

  const updateVar = (varId: string, field: keyof EnvVariable, value: string | boolean) => {
    if (!selected) return;
    updateVars(selected.variables.map(v => (v.id === varId ? { ...v, [field]: value } : v)));
  };

  const removeVar = (varId: string) => {
    if (!selected) return;
    updateVars(selected.variables.filter(v => v.id !== varId));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Environments</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-gray-700 flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {environments.map(env => (
                <div
                  key={env.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm ${selectedId === env.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                  onClick={() => setSelectedId(env.id)}
                >
                  <span className="truncate flex-1">{env.name}</span>
                  {activeEnvironmentId === env.id && (
                    <span className="ml-1 text-green-400 text-xs">●</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={createEnv}
              className="m-2 text-blue-400 hover:text-blue-300 text-sm text-left px-2 py-1"
            >+ New</button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
            {selected ? (
              <>
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
                    value={selected.name}
                    onChange={e => updateName(e.target.value)}
                  />
                  <button
                    onClick={() => onSwitch(activeEnvironmentId === selected.id ? null : selected.id)}
                    className={`px-3 py-1 rounded text-sm ${activeEnvironmentId === selected.id ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {activeEnvironmentId === selected.id ? 'Active' : 'Set Active'}
                  </button>
                  <button
                    onClick={() => deleteEnv(selected.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2"
                  >Delete</button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                  <div className="text-gray-400 text-xs mb-1">Variables</div>
                  {selected.variables.map(v => (
                    <div key={v.id} className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={v.enabled}
                        onChange={e => updateVar(v.id, 'enabled', e.target.checked)}
                        className="accent-blue-500"
                      />
                      <input
                        className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
                        placeholder="KEY"
                        value={v.key}
                        onChange={e => updateVar(v.id, 'key', e.target.value)}
                      />
                      <input
                        className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
                        placeholder="value"
                        value={v.value}
                        onChange={e => updateVar(v.id, 'value', e.target.value)}
                      />
                      <button
                        onClick={() => removeVar(v.id)}
                        className="text-gray-400 hover:text-red-400 text-lg leading-none px-1"
                      >×</button>
                    </div>
                  ))}
                  <button
                    onClick={addVar}
                    className="self-start text-blue-400 hover:text-blue-300 text-sm mt-1"
                  >+ Add Variable</button>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">Select or create an environment</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
