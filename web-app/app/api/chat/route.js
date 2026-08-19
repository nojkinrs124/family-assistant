export async function POST(req) {
  const { messages } = await req.json();

  const systemPrompt = `Ты семейный ассистент по покупкам. Помогаешь составить список покупок из магазина Лента (Красноярск).

Когда пользователь просит купить продукты:
1. Подтверди что понял список
2. Скажи что добавишь товары в корзину Ленты
3. Уточни если что-то непонятно (количество, марка и т.д.)

Отвечай по-русски, дружелюбно и кратко.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://family-assistant.vercel.app',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
    }),
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || 'Что-то пошло не так, попробуй ещё раз.';

  return Response.json({ reply });
}
