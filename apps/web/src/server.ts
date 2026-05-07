import { AgentLoop } from '@yaca/agent-core/agent-loop.js';
import { parseUserInput } from '@yaca/agent-core/preprocess/input.js';
import http from 'node:http';

export function startServer(options: { port: number; agent: AgentLoop; cwd: string }): http.Server {
  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === 'POST' && request.url === '/chat') {
      try {
        const body = JSON.parse(await readRequestBody(request)) as { message?: string };
        if (typeof body.message !== 'string') {
          throw new Error('message must be a string');
        }
        const content = await parseUserInput(body.message, options.cwd);
        const events = await options.agent.run([{ role: 'user', content }]);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ events }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(options.port);
  return server;
}

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}
