import { searchProducts, addToCart } from './lentaApi.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Парсим список товаров через ИИ
async function parseShoppingList(userMessage) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Извлеки список товаров из сообщения. Верни ТОЛЬКО JSON массив объектов.
Пример: [{"query":"молоко","quantity":2},{"query":"хлеб белый","quantity":1}]
Без пояснений, только JSON.`,
        },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return [];
  }
}

export async function runShoppingAgent(userMessage) {
  // 1. Парсим что нужно купить
  const items = await parseShoppingList(userMessage);
  if (!items.length) {
    return 'Не понял что нужно купить. Напиши, например: «купи молоко и хлеб»';
  }

  const results = [];
  const errors = [];

  // 2. Ищем каждый товар и добавляем в корзину
  for (const item of items) {
    try {
      const products = await searchProducts(item.query, 3);
      if (!products.length) {
        errors.push(`❌ «${item.query}» — не найдено`);
        continue;
      }

      // Берём первый результат
      const best = products[0];
      await addToCart(best.id, item.quantity || 1);

      const price = best.price ? ` — ${best.price} ₽` : '';
      results.push(`✅ ${best.name}${price} × ${item.quantity || 1}`);
    } catch (err) {
      errors.push(`❌ «${item.query}» — ошибка: ${err.message}`);
    }
  }

  // 3. Формируем ответ
  let reply = '';

  if (results.length) {
    reply += `🛒 Добавил в корзину:\n${results.join('\n')}\n\n`;
    reply += `👉 [Открыть корзину и оплатить](https://lenta.com/cart)`;
  }

  if (errors.length) {
    reply += `\n\n${errors.join('\n')}`;
  }

  if (!results.length) {
    reply = `Не удалось добавить товары:\n${errors.join('\n')}`;
  }

  return reply;
}
