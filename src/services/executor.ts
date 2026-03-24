/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
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
        // BODY_JSON_PATH not yet fully implemented
        message = 'BODY_JSON_PATH not implemented';
        passed = false;
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

  const axiosResponse = await axios({
    method: request.method,
    url: request.url,
    headers,
    data: request.body || undefined,
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
