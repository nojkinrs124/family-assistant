import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const SYSTEM = `Ты семейный ассистент по покупкам из магазина Лента (Красноярск).

Когда пользователь просит купить продукты:
1. Распознай список товаров
2. Для каждого товара сформируй ссылку на поиск в Ленте:
   https://online.lenta.com/search?q=ТОВАР (где ТОВАР — название по-русски, пробелы заменить на +)
3. Отправь красивый список с ссылками

Пример ответа:
🛒 Собрал корзину:

• 🥛 [Молоко](https://online.lenta.com/search?q=молоко)
• 🍞 [Хлеб](https://online.lenta.com/search?q=хлеб)
• 🥚 [Яйца](https://online.lenta.com/search?q=яйца+куриные)

Открой каждую ссылку и добавь товар в корзину.

Отвечай по-русски, используй эмодзи, будь кратким и дружелюбным.`;

export async function runShoppingAgent(userMessage) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Не удалось обработать запрос. Попробуй ещё раз.';
}
