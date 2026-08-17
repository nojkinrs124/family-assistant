import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Конфигурация подключённых MCP-серверов (магазинов).
 * Лента — наш собственный (browser automation), запускается как
 * локальный сабпроцесс. ВкусВилл — официальный удалённый MCP
 * (см. https://mcp.vkusvill.ru/mcp), подключается по HTTP/SSE —
 * добавить, когда семья окажется в городе, где он есть.
 */
const SERVERS = [
  {
    id: 'lenta',
    command: 'node',
    args: [new URL('../../mcp-servers/lenta-mcp/src/index.js', import.meta.url).pathname],
  },
  // {
  //   id: 'vkusvill',
  //   url: 'https://mcp.vkusvill.ru/mcp', // подключить через StreamableHTTPClientTransport
  // },
];

const clients = new Map();

export async function initMcpPool() {
  for (const server of SERVERS) {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
    });
    const client = new Client({ name: `family-assistant-${server.id}`, version: '0.1.0' });
    await client.connect(transport);
    clients.set(server.id, client);
    console.log(`MCP подключён: ${server.id}`);
  }
}

/** Собирает единый список тулов со всех подключённых MCP-серверов
 *  в формате, который принимает Anthropic API (tools[]). */
export async function listAllTools() {
  const tools = [];
  for (const [serverId, client] of clients) {
    const { tools: serverTools } = await client.listTools();
    for (const t of serverTools) {
      tools.push({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
        _serverId: serverId, // внутреннее поле, не уходит в API
      });
    }
  }
  return tools;
}

export async function callTool(serverId, name, args) {
  const client = clients.get(serverId);
  if (!client) throw new Error(`MCP-сервер не найден: ${serverId}`);
  return client.callTool({ name, arguments: args });
}

/** По имени тула находит, к какому серверу он относится (нужно для callTool). */
export function findServerForTool(tools, toolName) {
  const tool = tools.find((t) => t.name === toolName);
  return tool?._serverId;
}
