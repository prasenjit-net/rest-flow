import type { RestEnvironment, RestRequest } from '../types';

export function resolveVariables(request: RestRequest, environment: RestEnvironment | null): RestRequest {
  if (!environment) return request;

  const vars = environment.variables.filter(v => v.enabled);
  const substitute = (str: string): string =>
    vars.reduce((acc, v) => acc.replaceAll(`{{${v.key}}}`, v.value), str);

  return {
    ...request,
    url: substitute(request.url),
    body: substitute(request.body),
    headers: request.headers.map(h => ({
      ...h,
      value: h.enabled ? substitute(h.value) : h.value,
    })),
  };
}
