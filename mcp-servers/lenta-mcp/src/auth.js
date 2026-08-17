/**
 * npm run auth
 *
 * Открывает видимое окно браузера. Логинишься вручную (телефон + SMS),
 * жмёшь Enter в терминале — сессия сохраняется в session-state.json
 * и дальше переиспользуется сервером (src/index.js) без повторного логина.
 */
import { chromium } from 'playwright';
import readline from 'node:readline';
import { STORE_URL, SESSION_FILE } from './browser.js';

function waitForEnter(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log(`Открываю ${STORE_URL} ...`);
await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });

console.log('\n>>> Залогинься вручную (телефон, код из SMS).');
await waitForEnter('>>> Когда залогинен — нажми Enter здесь...\n');

await context.storageState({ path: SESSION_FILE });
console.log(`Сессия сохранена: ${SESSION_FILE}`);
console.log('Храни этот файл как секрет (по значимости как пароль), не коммить в git.');

await browser.close();
