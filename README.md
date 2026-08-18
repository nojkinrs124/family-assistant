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

## Развёрнутая инфраструктура

- Supabase-проект: `family-assistant` (`ofoxcgswiucxatmtjgsz`), организация `nojkinrs124`, регион `ap-southeast-1`
- Миграции 0001–0007 (фундамент, покупки, финансы, security/performance hardening) применены, security-линтер Supabase чист (`get_advisors` → 0 замечаний)
- GitHub: `github.com/nojkinrs124/family-assistant` (приватный)

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
cp .env.example .env
# вписать: TELEGRAM_BOT_TOKEN, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm start
```

При `/start` бот сам создаёт профиль по `telegram_id` и, если семьи ещё
нет, создаёт её и назначает пользователя владельцем (`owner`) — вручную
ничего заводить не нужно.

## Статус / что дальше

- [x] Этап 1: миграция фундамента (families, profiles, family_members, settings, audit_logs, RLS)
- [x] Telegram `/start`: автосоздание профиля и семьи, запись действий в audit_logs
- [x] Lenta MCP: каркас (search / cart_add / checkout_link) — селекторы TODO
- [x] Telegram-бот: Shopping Agent с tool-calling поверх MCP
- [ ] Доработать реальные селекторы Ленты (нужен доступ к живому сайту)
- [ ] Проверить экран оплаты (SMS/3-D Secure или в один клик)
- [ ] Приглашение других участников семьи (второй пользователь в `family_members`)
- [x] Этап 2 схема: shopping_lists, orders, stores, store_integrations — применены к проду
- [ ] Этап 2 автоматизация: калибровка селекторов Ленты (блокер, нужен живой браузер)
- [x] Этап 3 схема: accounts, categories (13 seed), transactions, budgets, savings_goals — применены к проду
- [ ] Этап 4: карты/автооплата (реальный эквайринг)

Подробный план по шагам — в `docs/roadmap.md`.

## Безопасность

- `session-state.json` (сохранённая сессия Ленты) — секрет уровня пароля,
  никогда не коммитится (см. `.gitignore`), в проде — Supabase Vault.
- `SUPABASE_SERVICE_ROLE_KEY` обходит RLS — живёт только в `.env` на
  сервере бота, никогда не в клиентском коде и не в git.
- `.env` с токенами — не коммитится.
- RLS включён на всех таблицах с первой миграции.
- Карта оплаты нигде в этом репозитории не хранится — оплата всегда
  завершается пользователем вручную в интерфейсе магазина.
