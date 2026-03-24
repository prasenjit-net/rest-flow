import Dexie, { type Table } from 'dexie';
import type { RestRequest, RestCollection, RestEnvironment, HistoryEntry } from '../types';

export class RestflowDB extends Dexie {
  collections!: Table<RestCollection>;
  requests!: Table<RestRequest>;
  environments!: Table<RestEnvironment>;
  history!: Table<HistoryEntry>;

  constructor() {
    super('RestflowDB');
    this.version(1).stores({
      collections: 'id, name, createdAt',
      requests: 'id, collectionId, name, updatedAt',
      environments: 'id, name, isActive',
    });
    this.version(2).stores({
      collections: 'id, name, createdAt',
      requests: 'id, collectionId, name, updatedAt',
      environments: 'id, name, isActive',
      history: 'id, requestId, collectionId, executedAt',
    });
  }
}

export const db = new RestflowDB();
