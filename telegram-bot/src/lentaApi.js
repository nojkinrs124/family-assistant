import { readFileSync } from 'fs';
import path from 'path';
import { ProxyAgent } from 'undici';

const SESSION_FILE = process.env.LENTA_SESSION_FILE
  || path.join(process.cwd(), '../mcp-servers/lenta-mcp/session-state.json');

// Прокси на Mac через SSH-туннель (localhost:8888 → Mac → Лента)
const PROXY_URL = process.env.LENTA_PROXY || 'http://127.0.0.1:8888';
const proxyAgent = new ProxyAgent(PROXY_URL);

function getCookies() {
  try {
    const state = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    return state.cookies || [];
  } catch { return []; }
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

function baseHeaders(cookies) {
  const deviceId = getCookieValue(cookies, 'Utk_DvcGuid');
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'ru-RU,ru;q=0.9',
    'content-type': 'application/json',
    'cookie': cookieString(cookies),
    'origin': 'https://lenta.com',
    'referer': 'https://lenta.com/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-device-web-platform': 'desktop_web',
    'x-retail-brand': 'lo',
    'x-user-session-id': deviceId,
  };
}

export async function searchProducts(query, limit = 3) {
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
    dispatcher: proxyAgent,
  });

  if (!res.ok) throw new Error(`Поиск вернул ${res.status}`);
  const data = await res.json();
  const items = data?.items || data?.goods || data?.data?.items || [];
  return items.slice(0, limit).map(item => ({
    id: item.id || item.goodsId || item.GoodsItemId,
    name: item.title || item.name || item.goodsName,
    price: item.price || item.regularPrice,
  }));
}

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
          MarketingPartnerKey: mpk || '',
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
    dispatcher: proxyAgent,
  });

  if (!res.ok) throw new Error(`Корзина вернула ${res.status}`);
  return await res.json();
}
