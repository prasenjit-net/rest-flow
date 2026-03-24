import Dexie, { type Table } from 'dexie';
import type { RestRequest, RestCollection, RestEnvironment } from '../types';

export class RestflowDB extends Dexie {
  collections!: Table<RestCollection>;
  requests!: Table<RestRequest>;
  environments!: Table<RestEnvironment>;

  constructor() {
    super('RestflowDB');
    this.version(1).stores({
      collections: 'id, name, createdAt',
      requests: 'id, collectionId, name, updatedAt',
      environments: 'id, name, isActive',
    });
  }
}

export const db = new RestflowDB();
