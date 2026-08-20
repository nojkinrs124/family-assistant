import { readFileSync } from 'fs';
import path from 'path';

const SESSION_FILE = process.env.LENTA_SESSION_FILE
  || path.join(process.cwd(), '../mcp-servers/lenta-mcp/session-state.json');

// Читаем куки из session-state.json
function getCookies() {
  try {
    const state = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    return state.cookies || [];
  } catch {
    return [];
  }
}

function cookieString(cookies) {
  return cookies
    .filter(c => c.domain?.includes('lenta.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

function getCookieValue(cookies, name) {
  return cookies.find(c => c.name === name)?.value || '';
}

// Базовые заголовки
function baseHeaders(cookies) {
  const cookieStr = cookieString(cookies);
  const sessionToken = getCookieValue(cookies, 'Utk_SessionToken') || getCookieValue(cookies, 'Utk_SssTkn');
  const deviceId = getCookieValue(cookies, 'Utk_DvcGuid');
  const passportId = getCookieValue(cookies, 'x-passport-id');
  
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'ru-RU,ru;q=0.9',
    'content-type': 'application/json',
    'cookie': cookieStr,
    'origin': 'https://lenta.com',
    'referer': 'https://lenta.com/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-device-web-platform': 'desktop_web',
    'x-retail-brand': 'lo',
    'x-user-session-id': deviceId,
    ...(passportId && { 'x-passport-id': passportId }),
  };
}

// Поиск товаров
export async function searchProducts(query, limit = 5) {
  const cookies = getCookies();
  
  const res = await fetch('https://lenta.com/api-gateway/v1/catalog/items', {
    method: 'POST',
    headers: baseHeaders(cookies),
    body: JSON.stringify({
      query,
      filters: { checkbox: [], multicheckbox: [], range: [] },
      limit,
      offset: 0,
      sort: { type: 'popular', order: 'desc' },
    }),
  });

  if (!res.ok) throw new Error(`Поиск вернул ${res.status}`);
  const data = await res.json();
  
  // Возвращаем первые N товаров
  const items = data?.items || data?.goods || data?.data?.items || [];
  return items.slice(0, limit).map(item => ({
    id: item.id || item.goodsId || item.GoodsItemId,
    name: item.title || item.name || item.goodsName,
    price: item.price || item.regularPrice,
    unit: item.unit || item.unitOfMeasure || 'шт',
  }));
}

// Добавление в корзину
export async function addToCart(goodsItemId, quantity = 1) {
  const cookies = getCookies();
  const sessionToken = getCookieValue(cookies, 'Utk_SessionToken') || getCookieValue(cookies, 'Utk_SssTkn');
  const deviceId = getCookieValue(cookies, 'Utk_DvcGuid');
  const mpk = getCookieValue(cookies, 'App_Cache_MPK');

  const res = await fetch('https://lenta.com/api/rest/cartItemModify', {
    method: 'POST',
    headers: {
      ...baseHeaders(cookies),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      data: JSON.stringify({
        Head: {
          MarketingPartnerKey: mpk || 'mp80-661295c9cbf9d6b2f6428414504a8deed3020641',
          Version: 'web-12.0.762',
          Client: 'angular_web_0.0.2',
          Method: 'cartItemModify',
          RequestId: `cartItemModify_${Date.now()}`,
          DeviceId: deviceId,
          Domain: 'krsk',
          SessionToken: sessionToken,
        },
        Body: {
          GoodsItemId: String(goodsItemId),
          Quantity: quantity,
          Return: { Cart: 1, Goods: 1, ShowCartItemModifyNotices: 1 },
        },
      }),
    }),
  });

  if (!res.ok) throw new Error(`Корзина вернула ${res.status}`);
  const data = await res.json();
  return data;
}
