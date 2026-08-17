import { openContext, STORE_URL, humanPause } from '../browser.js';

/**
 * Добавляет товар в корзину по productId (полученному из lentaSearch)
 * или по имени, если id нет под рукой.
 *
 * ВНИМАНИЕ: селекторы — заготовки (TODO), см. пояснение в search.js.
 */
export async function lentaAddToCart({ productId, name, quantity = 1 }) {
  if (!productId && !name) {
    throw new Error('Нужен productId или name');
  }

  const { browser, context } = await openContext();
  try {
    const page = await context.newPage();
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

    let card;
    if (productId) {
      // TODO: реальный селектор карточки по data-product-id
      card = page.locator(`[data-product-id="${productId}"]`).first();
    } else {
      const searchInput = page.locator('input[placeholder*="Найти" i], input[type="search"]').first();
      await searchInput.fill(name);
      await searchInput.press('Enter');
      await humanPause();
      card = page.locator('[class*="product-card" i], [data-testid*="product" i]').first();
    }

    await card.waitFor({ state: 'visible', timeout: 15000 });
    // TODO: реальный селектор кнопки "В корзину"
    const addButton = card.locator('button:has-text("В корзину"), button[aria-label*="корзин" i]').first();

    for (let i = 0; i < quantity; i++) {
      await addButton.click();
      await humanPause();
    }

    return { added: name || productId, quantity };
  } finally {
    await browser.close();
  }
}

/**
 * Открывает корзину и возвращает её содержимое + переход к чекауту.
 * До реальной оплаты НЕ доходит — останавливается на экране заказа
 * и сообщает, что нужен логин (SMS) на этом шаге, если сайт его требует.
 */
export async function lentaViewCartAndCheckoutLink() {
  const { browser, context } = await openContext();
  try {
    const page = await context.newPage();
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

    // TODO: реальный селектор ссылки/иконки корзины
    await page.locator('a[href*="basket" i], a[href*="cart" i]').first().click();
    await humanPause();

    // TODO: реальные селекторы позиций корзины и итоговой суммы
    const items = await page.locator('[class*="cart-item" i]').allTextContents();
    const total = await page.locator('[class*="cart-total" i], [class*="total-price" i]')
      .first().textContent().catch(() => null);

    const checkoutUrl = page.url();

    return {
      items,
      total: total?.trim() ?? null,
      checkoutUrl,
      note: 'Оформление и оплата — вручную по этой ссылке. Если сайт потребует SMS-код при переходе к оформлению, это ожидаемо: логин на чекауте отделён от наполнения корзины.',
    };
  } finally {
    await browser.close();
  }
}
