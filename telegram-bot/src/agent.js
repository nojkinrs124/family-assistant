import { listAllTools, callTool, findServerForTool } from './mcpPool.js';

/**
 * LLM-провайдер — OpenRouter (OpenAI-совместимый API).
 * Модель по умолчанию: openai/gpt-4o-mini — дёшево ($0.15/M токенов) и
 * надёжно по вызову тулов, что тут критично (модель должна класть
 * валидный JSON в lenta_cart_add и т.п.). Переопределяется через
 * OPENROUTER_MODEL, если захочешь попробовать другую.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `Ты — семейный ассистент по покупкам. Пользователь пишет
обычным языком, что нужно купить (список, рецепт, "как обычно" и т.п.).

Твоя задача:
1. Разбить запрос на позиции (название + количество).
2. Для каждой позиции вызвать lenta_search, выбрать наиболее подходящий
   товар (по названию и, если есть, цене).
3. Добавить выбранные товары в корзину через lenta_cart_add.
4. В конце вызвать lenta_checkout_link и показать пользователю итоговую
   сумму и ссылку для оформления — оплату сам не завершаешь, это делает
   пользователь вручную.

Отвечай кратко, по-русски, в формате: список позиций с ценами, итог, ссылка.
Если что-то не нашлось — прямо скажи, не выдумывай.`;

/** MCP input_schema (JSON Schema) 1-в-1 подходит как OpenAI function.parameters. */
function mcpToolToOpenAiTool({ name, description, input_schema }) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: input_schema ?? { type: 'object', properties: {} },
    },
  };
}

/** tool-сообщение в OpenAI-формате должно быть строкой, а не массивом блоков. */
function mcpResultToString(result) {
  if (!result?.content) return 'OK';
  return result.content
    .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('\n') || 'OK';
}

async function callOpenRouter(messages, tools) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://github.com/nojkinrs124/family-assistant',
      'X-Title': 'Family Assistant Shopping Agent',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  return res.json();
}

/**
 * Обрабатывает одно сообщение пользователя: гоняет цикл tool-calling,
 * пока модель не даст финальный текстовый ответ без вызова тулов.
 */
export async function runShoppingAgent(userMessage) {
  const tools = await listAllTools();
  const openAiTools = tools.map(mcpToolToOpenAiTool);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  for (let step = 0; step < 12; step++) { // maxSteps — защита от зацикливания
    const response = await callOpenRouter(messages, openAiTools);
    const choice = response.choices?.[0];
    if (!choice) throw new Error('OpenRouter вернул ответ без choices');

    const { message } = choice;
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return message.content?.trim() || 'Пустой ответ от модели.';
    }

    messages.push(message);

    for (const toolCall of toolCalls) {
      const { name } = toolCall.function;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        // Модель иногда присылает невалидный JSON — не роняем весь цикл,
        // отдаём ей ошибку как tool-результат, пусть попробует ещё раз.
      }

      const serverId = findServerForTool(tools, name);
      let content;
      try {
        const result = await callTool(serverId, name, args);
        content = mcpResultToString(result);
      } catch (err) {
        content = `Ошибка: ${err.message}`;
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content,
      });
    }
  }

  return 'Не получилось завершить подбор корзины за разумное число шагов — попробуй сформулировать запрос проще.';
}
