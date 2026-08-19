# 📖 Полная инструкция для новичка — с нуля до работающего бота

Этот гайд написан так, чтобы его мог выполнить человек, который никогда не держал в руках сервер. Идём шаг за шагом.

---

## Что ты получишь в итоге

Telegram-бот, которому можно написать:
> «Купи молоко, хлеб и яйца в Ленте»

Бот сам найдёт товары, добавит в корзину и пришлёт тебе ссылку — ты только подтвердишь оплату.

---

## Что тебе понадобится

| Что | Где взять | Стоимость |
|-----|-----------|-----------|
| VPS-сервер | REG.RU, Selectel, Timeweb, Beget | ~300–500 ₽/мес |
| Telegram-аккаунт | Уже есть | Бесплатно |
| Аккаунт на Supabase | supabase.com | Бесплатно |
| Аккаунт на OpenRouter | openrouter.ai | ~$5 хватит надолго |
| Аккаунт на GitHub | github.com | Бесплатно |
| Аккаунт в Ленте | online.lenta.com | Бесплатно |

---

## ЧАСТЬ 1 — Подготовка аккаунтов

### 1.1 Создай Telegram-бота

1. Открой Telegram, найди **@BotFather**
2. Напиши `/newbot`
3. Придумай название бота (например: `Семейный помощник`)
4. Придумай username (например: `my_family_helper_bot`) — должен заканчиваться на `bot`
5. BotFather пришлёт **токен** вида `7123456789:AAFxxx...` — скопируй его, пригодится

### 1.2 Получи OpenRouter API ключ

1. Зайди на [openrouter.ai](https://openrouter.ai)
2. Зарегистрируйся → пополни баланс на $5 (хватит на сотни запросов)
3. Перейди в **Keys** → **Create Key**
4. Скопируй ключ вида `sk-or-v1-...`

### 1.3 Получи Supabase ключи

1. Зайди на [supabase.com](https://supabase.com) → войди в свой проект `family-assistant`
2. Слева внизу: **Settings** → **API**
3. Скопируй:
   - **Project URL**: `https://ofoxcgswiucxatmtjgsz.supabase.co`
   - **service_role** (секретный ключ, не anon!) — длинная строка начинается с `eyJ...`

> ⚠️ `service_role` — это как пароль root к базе. Никому не показывай.

---

## ЧАСТЬ 2 — Покупка и настройка VPS

### 2.1 Выбери VPS

Рекомендую для начала:
- **REG.RU** — VPS-1 (~300 ₽/мес, 1 CPU, 1GB RAM) — хватит
- **Selectel** — Cloud Server минимальный (~350 ₽/мес)
- **Timeweb** — Cloud VPS (~290 ₽/мес)

При заказе выбери:
- ОС: **Ubuntu 22.04**
- Регион: любой (Москва/СПб быстрее)

После оплаты получишь:
- IP-адрес (например `185.123.45.67`)
- Логин: `root`
- Пароль: придумаешь сам или придёт в письме

### 2.2 Подключись к серверу

**На Windows** — скачай [PuTTY](https://putty.org):
1. Host Name: твой IP
2. Port: 22
3. Open → введи `root` и пароль

**На Mac/Linux** — открой Терминал:
```bash
ssh root@185.123.45.67
# Введи пароль
```

Ты окажешься внутри сервера. Теперь устанавливаем всё нужное.

### 2.3 Установи Docker

Выполни эти команды одну за другой (можно скопировать блок целиком):

```bash
# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com | sh

# Проверяем что установилось
docker --version
docker compose version
```

Должно появиться что-то вроде `Docker version 25.x.x` — значит всё ок.

---

## ЧАСТЬ 3 — Скачиваем проект

```bash
# Переходим в домашнюю папку
cd /home

# Клонируем репозиторий
git clone https://github.com/nojkinrs124/family-assistant.git

# Переходим в папку проекта
cd family-assistant

# Убеждаемся что всё скачалось
ls
```

Должны увидеть файлы: `docker-compose.yml`, `DEPLOY.md`, `README.md` и папки.

---

## ЧАСТЬ 4 — Настраиваем конфигурацию

### 4.1 Создай файл .env

```bash
# Копируем шаблон
cp .env.example .env

# Открываем редактор
nano .env
```

Откроется текстовый редактор. Заполни каждую строку своими данными:

```
TELEGRAM_BOT_TOKEN=7123456789:AAFxxx...     ← токен от BotFather
OPENROUTER_API_KEY=sk-or-v1-...            ← ключ OpenRouter
OPENROUTER_MODEL=openai/gpt-4o-mini        ← оставь как есть
SUPABASE_URL=https://ofoxcgswiucxatmtjgsz.supabase.co  ← уже заполнено
SUPABASE_SERVICE_ROLE_KEY=eyJ...           ← service_role ключ
```

Сохрани файл: нажми **Ctrl+O**, затем **Enter**, затем **Ctrl+X**

### 4.2 Проверь что .env не попадёт в интернет

```bash
# Убедись что .env есть в .gitignore
grep ".env" .gitignore
# Должно появиться строка: .env
```

---

## ЧАСТЬ 5 — Авторизация в Ленте (самый важный шаг)

Бот работает от твоего аккаунта в Ленте. Нужно один раз залогиниться и сохранить сессию.

### 5.1 Установи Node.js на VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # должно быть v22.x
```

### 5.2 Установи зависимости для авторизации

```bash
cd /home/family-assistant/mcp-servers/lenta-mcp
npm install
npx playwright install chromium --with-deps
```

Это скачает браузер Chromium — займёт 1-2 минуты.

### 5.3 Настрой виртуальный дисплей

На сервере нет монитора, но браузеру он нужен. Создадим виртуальный:

```bash
# Устанавливаем Xvfb (виртуальный дисплей) и VNC (чтобы видеть экран)
apt install -y xvfb x11vnc net-tools

# Запускаем виртуальный дисплей
Xvfb :99 -screen 0 1280x720x24 &

# Запускаем VNC-сервер (без пароля, только локально)
x11vnc -display :99 -nopw -listen localhost -forever &

echo "Виртуальный дисплей готов"
```

### 5.4 Подключись к виртуальному дисплею с компьютера

Открой **новый** терминал/PuTTY на своём компьютере и создай SSH-туннель:

**На Windows (PuTTY):**
1. В PuTTY: Connection → SSH → Tunnels
2. Source port: `5900`
3. Destination: `localhost:5900`
4. Нажми Add → Open

**На Mac/Linux:**
```bash
ssh -L 5900:localhost:5900 root@185.123.45.67
# Оставь это окно открытым
```

Теперь скачай VNC-клиент:
- **Windows**: [TightVNC Viewer](https://tightvnc.com/download.php) или [RealVNC](https://realvnc.com/en/connect/download/viewer/)
- **Mac**: встроенное приложение Finder → Подключиться к серверу → `vnc://localhost:5900`

Подключись к `localhost:5900` — увидишь пустой серый экран (это нормально, это пустой рабочий стол).

### 5.5 Запусти авторизацию

Вернись в первый терминал (подключённый к VPS) и выполни:

```bash
cd /home/family-assistant/mcp-servers/lenta-mcp
DISPLAY=:99 node auth-interactive.js
```

В VNC-клиенте на твоём компьютере должен появиться браузер с сайтом Ленты.

В браузере:
1. Нажми **«Войти»**
2. Введи свой номер телефона
3. Введи SMS-код
4. Убедись что в шапке видно твоё имя/профиль

Вернись в терминал и нажми **Enter**.

В терминале появится:
```
✅ Сессия сохранена: ./session-state.json
```

### 5.6 Скопируй сессию в Docker volume

```bash
cd /home/family-assistant

# Создаём постоянное хранилище для сессии
docker volume create family-assistant_lenta-session

# Копируем сессию туда
docker run --rm \
  -v family-assistant_lenta-session:/data \
  -v /home/family-assistant/mcp-servers/lenta-mcp/session-state.json:/src/session.json:ro \
  alpine cp /src/session.json /data/session-state.json

echo "Сессия скопирована ✅"
```

---

## ЧАСТЬ 6 — Запуск бота

### 6.1 Сборка и запуск

```bash
cd /home/family-assistant

# Собираем образы и запускаем (первый раз займёт 5-10 минут)
docker compose up -d --build
```

### 6.2 Проверяем что всё работает

```bash
# Смотрим статус
docker compose ps
```

Должно быть примерно так:
```
NAME            STATUS
telegram-bot    running
lenta-mcp       running
```

```bash
# Смотрим логи (Ctrl+C чтобы выйти)
docker compose logs -f telegram-bot
```

Должны увидеть что-то вроде:
```
[bot] Запущен. Жду сообщений...
[mcpPool] Подключён к lenta-mcp
```

### 6.3 Тестируем бота

Открой Telegram, найди своего бота и напиши `/start`.

Бот должен ответить приветствием!

---

## ЧАСТЬ 7 — Обслуживание

### Посмотреть логи
```bash
docker compose logs -f
```

### Перезапустить бота
```bash
docker compose restart telegram-bot
```

### Остановить всё
```bash
docker compose down
```

### Обновить код (когда выйдет новая версия)
```bash
cd /home/family-assistant
git pull
docker compose up -d --build
```

### Когда сессия Ленты протухнет (~30 дней)

Бот начнёт отвечать ошибкой. Повтори Часть 5 (шаги 5.3–5.6), затем:

```bash
docker compose restart telegram-bot
```

---

## Решение проблем

### Бот не отвечает

```bash
docker compose logs telegram-bot
# Смотри на ошибки в тексте
```

Частые причины:
- Неверный `TELEGRAM_BOT_TOKEN` → проверь .env
- Неверный `SUPABASE_SERVICE_ROLE_KEY` → скопируй заново из Dashboard
- Упал контейнер → `docker compose up -d`

### Ошибка «Нет сессии Ленты»

Повтори авторизацию (Часть 5).

### Не удаётся подключиться к VPS по SSH

Проверь:
- Правильный ли IP-адрес
- Не заблокирован ли порт 22 в настройках VPS (firewall)

### Docker: permission denied

```bash
# Добавь себя в группу docker (перелогинься после)
usermod -aG docker $USER
```

---

## Структура проекта (для понимания)

```
family-assistant/
├── telegram-bot/          ← Telegram-бот (Node.js)
│   └── src/
│       ├── index.js       ← Точка входа, обработка сообщений
│       ├── agent.js       ← ИИ-агент (OpenRouter + tool calling)
│       ├── family.js      ← Работа с базой данных (Supabase)
│       └── mcpPool.js     ← Подключение к MCP-серверам
├── mcp-servers/
│   └── lenta-mcp/         ← MCP-сервер для Ленты (Playwright)
│       └── src/
│           ├── index.js   ← Точка входа MCP
│           ├── browser.js ← Управление браузером
│           └── tools/     ← Инструменты: поиск, корзина
├── supabase/
│   └── migrations/        ← Структура базы данных
├── docker-compose.yml     ← Запуск всех сервисов
├── .env                   ← Твои секреты (не в git!)
└── GUIDE.md               ← Этот файл
```

---

## Архитектура простыми словами

```
Ты пишешь боту
       ↓
Telegram-бот получает сообщение
       ↓
ИИ (GPT-4o-mini через OpenRouter) понимает что нужно купить
       ↓
ИИ вызывает инструменты MCP-сервера Ленты:
  1. lenta_search("молоко") → находит товар
  2. lenta_cart_add(товар_id) → добавляет в корзину
  3. lenta_checkout_link() → генерирует ссылку на оплату
       ↓
Бот отправляет тебе ссылку
       ↓
Ты переходишь по ссылке и оплачиваешь сам
```

Оплата всегда через тебя — бот никогда не списывает деньги сам.

