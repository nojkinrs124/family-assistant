#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { lentaSearch } from './tools/search.js';
import { lentaAddToCart, lentaViewCartAndCheckoutLink } from './tools/cart.js';

const server = new McpServer({
  name: 'lenta-mcp',
  version: '0.1.0',
});

server.registerTool(
  'lenta_search',
  {
    title: 'Поиск товаров в Ленте',
    description: 'Ищет товары в каталоге online.lenta.com по ключевым словам и возвращает список кандидатов с ценой и id.',
    inputSchema: {
      query: z.string().describe('Поисковый запрос, напр. "молоко 2.5%"'),
      limit: z.number().int().min(1).max(20).optional().describe('Сколько кандидатов вернуть (по умолчанию 5)'),
    },
  },
  async ({ query, limit }) => {
    const result = await lentaSearch({ query, limit });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  'lenta_cart_add',
  {
    title: 'Добавить товар в корзину',
    description: 'Добавляет товар в корзину Ленты по productId (из lenta_search) или по названию.',
    inputSchema: {
      productId: z.string().optional(),
      name: z.string().optional(),
      quantity: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ productId, name, quantity }) => {
    const result = await lentaAddToCart({ productId, name, quantity });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  'lenta_checkout_link',
  {
    title: 'Посмотреть корзину и получить ссылку на оформление',
    description: 'Возвращает текущее содержимое корзины, итоговую сумму и ссылку для ручного оформления/оплаты заказа. Реальную оплату не производит.',
    inputSchema: {},
  },
  async () => {
    const result = await lentaViewCartAndCheckoutLink();
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('lenta-mcp запущен (stdio)');
