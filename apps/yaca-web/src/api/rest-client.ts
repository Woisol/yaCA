import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetConfigResponse,
  GetMessagesResponse,
  GetSessionResponse,
  ListSessionsResponse,
  ListToolsResponse,
  RewindRequest,
  RewindResponse,
  UpdateAllowToolsRequest,
  UpdateConfigRequest,
  UpdateConfigResponse
} from './types.js';

export const rest = {
  listSessions: () => request<ListSessionsResponse>('/api/sessions'),
  createSession: (body: CreateSessionRequest = {}) => request<CreateSessionResponse>('/api/sessions', { method: 'POST', body }),
  getSession: (sessionId: string) => request<GetSessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`),
  getMessages: (sessionId: string) => request<GetMessagesResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`),
  rewind: (sessionId: string, body: RewindRequest) => request<RewindResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/rewind`, { method: 'POST', body }),
  getConfig: () => request<GetConfigResponse>('/api/config'),
  updateConfig: (body: UpdateConfigRequest) => request<UpdateConfigResponse>('/api/config', { method: 'PATCH', body }),
  listTools: () => request<ListToolsResponse>('/api/tools'),
  updateAllow: (body: UpdateAllowToolsRequest) => request<ListToolsResponse>('/api/tools/allow', { method: 'POST', body })
};

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json() as T | { error?: { message?: string } };
  if (!response.ok) {
    const errorMessage = typeof data === 'object' && data !== null && 'error' in data
      ? data.error?.message ?? response.statusText
      : response.statusText;
    throw new Error(errorMessage);
  }
  return data as T;
}
