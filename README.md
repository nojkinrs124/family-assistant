# Family Assistant

Личный семейный ассистент: Telegram-бот, который понимает обычный язык
("купи молоко и хлеб"), сам собирает корзину в магазинах и ведёт
семейный учёт — покупки, финансы, накопления. Supabase — ядро данных,
MCP-серверы — модули-адаптеры под конкретные магазины.

## Архитектура

```
Telegram ──► Shopping Agent (Claude, tool-calling)
                    │
                    ├── lenta-mcp        (наш, Playwright + сохранённая сессия)
                    └── vkusvill-mcp     (официальный, mcp.vkusvill.ru — когда
                                          семья окажется в городе с ВкусВиллом)
                    │
             Supabase (Postgres + RLS)
                    │
        families / profiles / family_members /
        orders / transactions / shopping_lists / ...
```

Подробности решений — в `docs/architecture.md`.

## Структура репозитория

```
supabase/migrations/       — SQL-миграции (Этап 1: фундамент)
mcp-servers/lenta-mcp/      — MCP-сервер для Ленты (браузерная автоматизация)
telegram-bot/               — Telegram-бот + Shopping Agent
docs/                       — заметки по архитектуре и решениям
```

## Быстрый старт

### 1. Supabase

```bash
# применить миграции к своему проекту (через Supabase CLI или Dashboard → SQL editor)
supabase db push
```

### 2. Lenta MCP — сессия и проверка

```bash
cd mcp-servers/lenta-mcp
npm install
npx playwright install chromium
npm run auth        # один раз: логинишься вручную, вводишь SMS
```

Реальные CSS-селекторы в `src/tools/*.js` и `src/index.js`-цепочке
помечены `TODO` — их нужно поправить под текущую вёрстку сайта через
DevTools (см. `docs/architecture.md` → "Известные ограничения").

### 3. Telegram-бот

```bash
cd telegram-bot
npm install
cp .env.example .env    # вписать TELEGRAM_BOT_TOKEN и ANTHROPIC_API_KEY
npm start
```

## Статус / что дальше

- [x] Этап 1: миграция фундамента (families, profiles, family_members, RLS)
- [x] Lenta MCP: каркас (search / cart_add / checkout_link) — селекторы TODO
- [x] Telegram-бот: Shopping Agent с tool-calling поверх MCP
- [ ] Доработать реальные селекторы Ленты (нужен доступ к живому сайту)
- [ ] Проверить экран оплаты (SMS/3-D Secure или в один клик)
- [ ] Этап 2: shopping_lists, orders, stores — таблицы и связка с MCP
- [ ] Этап 3: finance (accounts, transactions, budgets, savings_goals)
- [ ] Этап 4: карты/автооплата (реальный эквайринг)

## Безопасность

- `session-state.json` (сохранённая сессия Ленты) — секрет уровня пароля,
  никогда не коммитится (см. `.gitignore`), в проде — Supabase Vault.
- `.env` с токенами — не коммитится.
- RLS включён на всех таблицах с первой миграции.
