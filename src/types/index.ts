export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface Header {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type AssertionType = 'STATUS_CODE' | 'RESPONSE_TIME' | 'BODY_CONTAINS' | 'BODY_JSON_PATH';

export interface Assertion {
  id: string;
  type: AssertionType;
  operator: 'eq' | 'neq' | 'lt' | 'gt' | 'contains';
  expected: string;
  jsonPath?: string;
  enabled: boolean;
}

export interface AssertionResult {
  id: string;
  type: AssertionType;
  passed: boolean;
  message: string;
}

export interface RestRequest {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: string;
  assertions: Assertion[];
  createdAt: number;
  updatedAt: number;
}

export interface RestCollection {
  id: string;
  name: string;
  createdAt: number;
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface RestEnvironment {
  id: string;
  name: string;
  variables: EnvVariable[];
  isActive: boolean;
  createdAt: number;
}

export interface RestResponse {
  status: number;
  statusText: string;
  responseTime: number;
  headers: Record<string, string>;
  body: string;
  assertionResults: AssertionResult[];
}
