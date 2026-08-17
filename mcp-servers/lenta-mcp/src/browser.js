import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STORE_URL = 'https://online.lenta.com/';
export const SESSION_FILE = process.env.LENTA_SESSION_FILE
  || path.join(__dirname, '..', 'session-state.json');

export function hasSession() {
  return fs.existsSync(SESSION_FILE);
}

/**
 * Открывает контекст браузера с переиспользуемой сессией.
 * headless по умолчанию true — для рабочего MCP-сервера.
 * Для отладки можно передать { headless: false }.
 */
export async function openContext({ headless = true } = {}) {
  if (!hasSession()) {
    throw new Error(
      `Нет сохранённой сессии (${SESSION_FILE}). ` +
      `Сначала выполни: npm run auth`
    );
  }
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  return { browser, context };
}

/** Случайная человекоподобная пауза, чтобы не долбить сайт слишком ровно. */
export function humanPause(minMs = 400, maxMs = 900) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
