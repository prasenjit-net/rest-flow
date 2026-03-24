import { v4 as uuidv4 } from 'uuid';
import type { Assertion, AssertionType } from '../types';

interface Props {
  assertions: Assertion[];
  onChange: (assertions: Assertion[]) => void;
}

const ASSERTION_TYPES: AssertionType[] = ['STATUS_CODE', 'RESPONSE_TIME', 'BODY_CONTAINS', 'BODY_JSON_PATH'];
const OPERATORS = ['eq', 'neq', 'lt', 'gt', 'contains'] as const;

export default function AssertionList({ assertions, onChange }: Props) {
  const add = () =>
    onChange([
      ...assertions,
      { id: uuidv4(), type: 'STATUS_CODE', operator: 'eq', expected: '200', enabled: true },
    ]);

  const update = (id: string, field: keyof Assertion, value: string | boolean) =>
    onChange(assertions.map(a => (a.id === id ? { ...a, [field]: value } : a)));

  const remove = (id: string) => onChange(assertions.filter(a => a.id !== id));

  return (
    <div className="flex flex-col gap-2">
      {assertions.map(a => (
        <div key={a.id} className="flex gap-2 items-center flex-wrap">
          <input
            type="checkbox"
            checked={a.enabled}
            onChange={e => update(a.id, 'enabled', e.target.checked)}
            className="accent-blue-500"
          />
          <select
            value={a.type}
            onChange={e => update(a.id, 'type', e.target.value)}
            className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
          >
            {ASSERTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={a.operator}
            onChange={e => update(a.id, 'operator', e.target.value)}
            className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
          >
            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          {a.type === 'BODY_JSON_PATH' && (
            <input
              className="w-32 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
              placeholder="$.path"
              value={a.jsonPath ?? ''}
              onChange={e => update(a.id, 'jsonPath', e.target.value)}
            />
          )}
          <input
            className="flex-1 border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
            placeholder="Expected value"
            value={a.expected}
            onChange={e => update(a.id, 'expected', e.target.value)}
          />
          <button
            onClick={() => remove(a.id)}
            className="text-gray-400 hover:text-red-400 text-lg leading-none px-1"
            title="Remove"
          >×</button>
        </div>
      ))}
      <button
        onClick={add}
        className="self-start text-blue-400 hover:text-blue-300 text-sm mt-1"
      >+ Add Assertion</button>
    </div>
  );
}
