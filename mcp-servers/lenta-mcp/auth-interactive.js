#!/usr/bin/env node
/**
 * Одноразовый скрипт первичной авторизации.
 * Запускать НА VPS через: node auth-interactive.js
 * 
 * Открывает браузер в режиме отображения (нужен X11 или VNC),
 * ждёт пока ты вручную залогинишься (телефон + SMS),
 * сохраняет сессию в session-state.json.
 * 
 * Если на VPS нет дисплея — используй вариант с VNC:
 *   apt install x11vnc xvfb
 *   Xvfb :99 -screen 0 1280x720x24 &
 *   DISPLAY=:99 x11vnc -display :99 -nopw -listen localhost -xkb &
 *   ssh -L 5900:localhost:5900 user@your-vps
 *   # подключись VNC-клиентом к localhost:5900
 *   DISPLAY=:99 node auth-interactive.js
 */

import { chromium } from 'playwright';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = process.env.LENTA_SESSION_FILE
  || path.join(__dirname, 'session-state.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

console.log('=== Авторизация в Ленте ===');
console.log(`Сессия будет сохранена в: ${SESSION_FILE}\n`);

const browser = await chromium.launch({
  headless: false,   // нужен дисплей
  slowMo: 50,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const context = await browser.newContext({
  locale: 'ru-RU',
  extraHTTPHeaders: { 'Accept-Language': 'ru-RU,ru;q=0.9' }
});

const page = await context.newPage();
console.log('Открываю online.lenta.com...');
await page.goto('https://online.lenta.com/', { waitUntil: 'domcontentloaded' });

console.log('\n👆 Браузер открыт. Залогинься вручную:');
console.log('   1. Нажми «Войти» на сайте');
console.log('   2. Введи номер телефона');
console.log('   3. Введи SMS-код');
console.log('   4. Убедись, что имя/аккаунт виден в шапке сайта');
await ask('\n✅ Нажми Enter здесь, когда залогинился...\n');

await context.storageState({ path: SESSION_FILE });
console.log(`\n✅ Сессия сохранена: ${SESSION_FILE}`);
console.log('Теперь можно запускать MCP-сервер: npm start (или docker compose up)');

await browser.close();
rl.close();
