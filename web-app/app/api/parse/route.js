export async function POST(req) {
  const { message } = await req.json();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Извлеки список товаров из сообщения. Верни ТОЛЬКО JSON массив без пояснений.
Пример: [{"query":"молоко","quantity":2},{"query":"хлеб","quantity":1}]`,
        },
        { role: 'user', content: message },
      ],
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '[]';
  try {
    const items = JSON.parse(text.replace(/```json|```/g, '').trim());
    return Response.json({ items });
  } catch {
    return Response.json({ items: [] });
  }
}
