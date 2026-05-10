import type { ClientWsMessage, ServerWsMessage } from './types.js';

export type WsClient = {
  send(message: ClientWsMessage): void;
  close(): void;
};

export function createWsClient(options: {
  onMessage(message: ServerWsMessage): void;
  onOpen?(): void;
  onClose?(): void;
  onError?(error: Event): void;
}): WsClient {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
  ws.addEventListener('open', () => options.onOpen?.());
  ws.addEventListener('close', () => options.onClose?.());
  ws.addEventListener('error', (error) => options.onError?.(error));
  ws.addEventListener('message', (event) => {
    options.onMessage(JSON.parse(String(event.data)) as ServerWsMessage);
  });
  return {
    send(message) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    close() {
      ws.close();
    }
  };
}
