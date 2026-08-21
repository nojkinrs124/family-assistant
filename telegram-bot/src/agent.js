// Агент теперь просто возвращает URL для Mini App
// Реальные запросы к Ленте делает браузер пользователя (его IP)

const APP_URL = process.env.MINI_APP_URL || 'https://family-assistant-web.vercel.app';

export function getShopUrl(userMessage) {
  return `${APP_URL}/shop?q=${encodeURIComponent(userMessage)}`;
}
