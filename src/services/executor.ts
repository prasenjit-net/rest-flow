/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { JSONPath } from 'jsonpath-plus';
import type { RestRequest, RestResponse, AssertionResult, Assertion } from '../types';

function runAssertions(assertions: Assertion[], response: Omit<RestResponse, 'assertionResults'>): AssertionResult[] {
  return assertions.filter(a => a.enabled).map(a => {
    let passed = false;
    let message = '';

    try {
      if (a.type === 'STATUS_CODE') {
        const code = parseInt(a.expected, 10);
        switch (a.operator) {
          case 'eq': passed = response.status === code; break;
          case 'neq': passed = response.status !== code; break;
          case 'lt': passed = response.status < code; break;
          case 'gt': passed = response.status > code; break;
          default: passed = false;
        }
        message = `Status ${response.status} ${a.operator} ${a.expected}: ${passed ? 'PASS' : 'FAIL'}`;
      } else if (a.type === 'RESPONSE_TIME') {
        const ms = parseInt(a.expected, 10);
        switch (a.operator) {
          case 'lt': passed = response.responseTime < ms; break;
          case 'gt': passed = response.responseTime > ms; break;
          case 'eq': passed = response.responseTime === ms; break;
          default: passed = false;
        }
        message = `Response time ${response.responseTime}ms ${a.operator} ${a.expected}ms: ${passed ? 'PASS' : 'FAIL'}`;
      } else if (a.type === 'BODY_CONTAINS') {
        passed = response.body.includes(a.expected);
        message = `Body contains "${a.expected}": ${passed ? 'PASS' : 'FAIL'}`;
      } else if (a.type === 'BODY_JSON_PATH') {
        const parsed = JSON.parse(response.body);
        const results = JSONPath({ path: a.jsonPath ?? '$', json: parsed });
        const actual = results.length > 0 ? String(results[0]) : '';
        switch (a.operator) {
          case 'eq': passed = actual === a.expected; break;
          case 'neq': passed = actual !== a.expected; break;
          case 'contains': passed = actual.includes(a.expected); break;
          default: passed = false;
        }
        message = `JSONPath ${a.jsonPath} = "${actual}" ${a.operator} "${a.expected}": ${passed ? 'PASS' : 'FAIL'}`;
      }
    } catch (err: any) {
      message = `Error: ${err.message}`;
      passed = false;
    }

    return { id: a.id, type: a.type, passed, message };
  });
}

export async function executeRequest(request: RestRequest): Promise<RestResponse> {
  const start = performance.now();

  const headers: Record<string, string> = {};
  for (const h of request.headers) {
    if (h.enabled && h.key) headers[h.key] = h.value;
  }

  // Apply auth
  const auth = request.auth;
  if (auth?.type === 'bearer' && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  } else if (auth?.type === 'basic' && auth.username) {
    headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password ?? ''}`)}`;
  } else if (auth?.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue) {
    if (auth.apiKeyIn === 'header') {
      headers[auth.apiKeyName] = auth.apiKeyValue;
    }
  }

  // Build URL (append apikey query param if needed)
  let requestUrl = request.url;
  if (auth?.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    try {
      const parsed = new URL(requestUrl);
      parsed.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
      requestUrl = parsed.toString();
    } catch {
      requestUrl = `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}${auth.apiKeyName}=${encodeURIComponent(auth.apiKeyValue)}`;
    }
  }

  // Build request data based on body format
  let data: string | FormData | URLSearchParams | undefined;
  if (request.bodyFormat === 'form') {
    const fd = new FormData();
    for (const p of request.formParams ?? []) {
      if (p.enabled && p.key) fd.append(p.key, p.value);
    }
    data = fd;
  } else if (request.bodyFormat === 'urlencoded') {
    const usp = new URLSearchParams();
    for (const p of request.formParams ?? []) {
      if (p.enabled && p.key) usp.append(p.key, p.value);
    }
    data = usp;
  } else {
    data = request.body || undefined;
  }

  const axiosResponse = await axios({
    method: request.method,
    url: requestUrl,
    headers,
    data,
    validateStatus: () => true,
  });

  const responseTime = Math.round(performance.now() - start);

  const responseHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(axiosResponse.headers)) {
    if (typeof v === 'string') responseHeaders[k] = v;
  }

  const body =
    typeof axiosResponse.data === 'string'
      ? axiosResponse.data
      : JSON.stringify(axiosResponse.data, null, 2);

  const partial = {
    status: axiosResponse.status,
    statusText: axiosResponse.statusText,
    responseTime,
    headers: responseHeaders,
    body,
  };

  return {
    ...partial,
    assertionResults: runAssertions(request.assertions, partial),
  };
}

