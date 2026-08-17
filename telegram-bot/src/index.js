import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { initMcpPool } from './mcpPool.js';
import { runShoppingAgent } from './agent.js';

const requiredEnv = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Не задана переменная окружения: ${key} (см. .env.example)`);
    process.exit(1);
  }
}

await initMcpPool();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply(
  'Привет! Я семейный ассистент по покупкам.\n' +
  'Напиши, что нужно купить, например: "купи молоко 2 и хлеб".'
));

bot.on('text', async (ctx) => {
  const thinking = await ctx.reply('Собираю корзину...');
  try {
    const answer = await runShoppingAgent(ctx.message.text);
    await ctx.telegram.editMessageText(ctx.chat.id, thinking.message_id, undefined, answer);
  } catch (err) {
    console.error(err);
    await ctx.telegram.editMessageText(
      ctx.chat.id, thinking.message_id, undefined,
      'Что-то пошло не так при сборе корзины. Попробуй ещё раз чуть позже.'
    );
  }
});

bot.launch();
console.log('Telegram-бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
