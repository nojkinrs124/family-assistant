import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

// Путь к lenta-mcp: в docker — монтируется как /app/lenta-mcp/src/index.js
// Локально — ../mcp-servers/lenta-mcp/src/index.js
const LENTA_MCP_PATH = process.env.LENTA_MCP_PATH
  || path.join(process.cwd(), '../mcp-servers/lenta-mcp/src/index.js');

const LENTA_SESSION_FILE = process.env.LENTA_SESSION_FILE
  || path.join(process.cwd(), '../mcp-servers/lenta-mcp/session-state.json');

let _client = null;

async function getClient() {
  if (_client) return _client;

  const transport = new StdioClientTransport({
    command: 'node',
    args: [LENTA_MCP_PATH],
    env: {
      ...process.env,
      LENTA_SESSION_FILE,
    },
  });

  _client = new Client({ name: 'telegram-bot', version: '1.0.0' }, {});
  await _client.connect(transport);
  console.log('[mcpPool] Подключён к lenta-mcp');
  return _client;
}

export async function listAllTools() {
  const client = await getClient();
  const { tools } = await client.listTools();
  return tools;
}

export async function callTool(name, args) {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  // MCP возвращает массив content-блоков — сводим к строке
  return result.content
    .map(b => (b.type === 'text' ? b.text : JSON.stringify(b)))
    .join('\n');
}

export async function findServerForTool(toolName) {
  const tools = await listAllTools();
  return tools.find(t => t.name === toolName) ? 'lenta-mcp' : null;
}
