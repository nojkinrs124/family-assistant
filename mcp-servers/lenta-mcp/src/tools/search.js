import { openContext, STORE_URL, humanPause } from '../browser.js';

/**
 * Ищет товар по названию, возвращает первые несколько карточек.
 *
 * ВНИМАНИЕ: селекторы ниже — заготовки (TODO), проверены не были
 * (у автора-ассистента нет сетевого доступа к online.lenta.com).
 * Поправить после инспекции реальной страницы через DevTools.
 */
export async function lentaSearch({ query, limit = 5 }) {
  const { browser, context } = await openContext();
  try {
    const page = await context.newPage();
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

    // TODO: реальный селектор строки поиска
    const searchInput = page.locator('input[placeholder*="Найти" i], input[type="search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill(query);
    await searchInput.press('Enter');
    await humanPause();

    // TODO: реальный селектор карточки товара в выдаче
    const cards = page.locator('[class*="product-card" i], [data-testid*="product" i]');
    await cards.first().waitFor({ state: 'visible', timeout: 15000 });

    const count = Math.min(await cards.count(), limit);
    const results = [];
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // TODO: реальные селекторы имени/цены/id внутри карточки
      const name = (await card.locator('[class*="name" i]').first().textContent().catch(() => null))?.trim();
      const price = (await card.locator('[class*="price" i]').first().textContent().catch(() => null))?.trim();
      const productId = await card.getAttribute('data-product-id').catch(() => null);
      results.push({ productId, name, price });
    }

    return { query, results };
  } finally {
    await browser.close();
  }
}
