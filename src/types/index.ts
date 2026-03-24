export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyFormat = 'raw' | 'json' | 'form' | 'urlencoded';

export interface FormParam {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
}

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
  bodyFormat?: BodyFormat;
  formParams?: FormParam[];
  auth?: AuthConfig;
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

export interface HistoryEntry {
  id: string;
  requestId: string;
  collectionId: string;
  requestName: string;
  collectionName: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: string;
  assertions: Assertion[];
  response: RestResponse;
  executedAt: number;
}
