import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { initMcpPool } from './mcpPool.js';
import { runShoppingAgent } from './agent.js';
import { getOrCreateProfile, getActiveFamily, createFamilyWithOwner, writeAuditLog } from './family.js';

const requiredEnv = ['TELEGRAM_BOT_TOKEN', 'OPENROUTER_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Не задана переменная окружения: ${key} (см. .env.example)`);
    process.exit(1);
  }
}

await initMcpPool();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * На каждое сообщение подтягиваем профиль+семью из Supabase.
 * Для MVP это отдельный запрос на сообщение — при росте нагрузки
 * стоит закэшировать по telegram_id в памяти процесса.
 */
async function ensureProfileAndFamily(ctx) {
  const profile = await getOrCreateProfile({
    telegramId: ctx.from.id,
    name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || ctx.from.username || 'Без имени',
    username: ctx.from.username ?? null,
  });

  let family = await getActiveFamily(profile.id);
  if (!family) {
    const familyName = `Семья ${profile.name}`.trim();
    const created = await createFamilyWithOwner({ profileId: profile.id, familyName });
    family = { id: created.id, name: created.name, role: 'owner' };
  }

  return { profile, family };
}

bot.start(async (ctx) => {
  try {
    const { family } = await ensureProfileAndFamily(ctx);
    await ctx.reply(
      `Привет! Я семейный ассистент по покупкам.\n` +
      `Твоя семья: «${family.name}» (роль: ${family.role}).\n\n` +
      `Напиши, что нужно купить, например: "купи молоко 2 и хлеб".`
    );
  } catch (err) {
    console.error(err);
    await ctx.reply('Не получилось создать профиль в базе. Попробуй ещё раз чуть позже.');
  }
});

bot.on('text', async (ctx) => {
  const thinking = await ctx.reply('Собираю корзину...');
  try {
    const { profile, family } = await ensureProfileAndFamily(ctx);
    const answer = await runShoppingAgent(ctx.message.text);

    await writeAuditLog({
      familyId: family.id,
      actorId: profile.id,
      action: 'shopping.cart_prepared',
      metadata: { request: ctx.message.text },
    });

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
