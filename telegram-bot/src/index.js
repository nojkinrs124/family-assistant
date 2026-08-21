import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { getShopUrl } from './agent.js';
import { getOrCreateProfile, getActiveFamily, createFamilyWithOwner, writeAuditLog } from './family.js';

const requiredEnv = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Не задана переменная: ${key}`);
    process.exit(1);
  }
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

async function ensureProfileAndFamily(ctx) {
  const profile = await getOrCreateProfile({
    telegramId: ctx.from.id,
    name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || ctx.from.username || 'Без имени',
    username: ctx.from.username ?? null,
  });
  let family = await getActiveFamily(profile.id);
  if (!family) {
    const created = await createFamilyWithOwner({ profileId: profile.id, familyName: `Семья ${profile.name}` });
    family = { id: created.id, name: created.name, role: 'owner' };
  }
  return { profile, family };
}

bot.start(async (ctx) => {
  try {
    const { family } = await ensureProfileAndFamily(ctx);
    await ctx.reply(
      `Привет! Я помогу купить продукты в Ленте 🛒\n\nСемья: «${family.name}»\n\nПросто напиши что нужно купить, например:\n«купи молоко, хлеб и яйца»`
    );
  } catch (err) {
    console.error(err);
    await ctx.reply('Что-то пошло не так. Попробуй ещё раз.');
  }
});

bot.on('text', async (ctx) => {
  try {
    const { profile, family } = await ensureProfileAndFamily(ctx);
    const url = getShopUrl(ctx.message.text);

    await writeAuditLog({
      familyId: family.id,
      actorId: profile.id,
      action: 'shopping.requested',
      metadata: { request: ctx.message.text },
    });

    // Отправляем кнопку которая открывает Mini App прямо в Telegram
    await ctx.reply('Нашёл твой запрос! Открой корзину 👇', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🛒 Собрать корзину в Ленте',
            web_app: { url },
          }
        ]]
      }
    });
  } catch (err) {
    console.error(err);
    await ctx.reply('Что-то пошло не так. Попробуй ещё раз.');
  }
});

bot.launch();
console.log('Telegram-бот запущен');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
