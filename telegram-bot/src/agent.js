import Anthropic from '@anthropic-ai/sdk';
import { listAllTools, callTool, findServerForTool } from './mcpPool.js';

const anthropic = new Anthropic(); // берёт ANTHROPIC_API_KEY из env

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

/**
 * Обрабатывает одно сообщение пользователя: гоняет цикл tool-calling,
 * пока модель не даст финальный текстовый ответ без вызова тулов.
 */
export async function runShoppingAgent(userMessage) {
  const tools = await listAllTools();
  const anthropicTools = tools.map(({ name, description, input_schema }) => ({
    name, description, input_schema,
  }));

  const messages = [{ role: 'user', content: userMessage }];

  for (let step = 0; step < 12; step++) { // maxSteps — защита от зацикливания
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');

    if (toolUses.length === 0) {
      // финальный ответ — собираем текстовые блоки
      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      const serverId = findServerForTool(tools, toolUse.name);
      try {
        const result = await callTool(serverId, toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.content,
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: [{ type: 'text', text: `Ошибка: ${err.message}` }],
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return 'Не получилось завершить подбор корзины за разумное число шагов — попробуй сформулировать запрос проще.';
}
