# Деплой на VPS — пошаговая инструкция

## Что нужно
- VPS с Ubuntu 22.04+, минимум 1GB RAM (рекомендую 2GB)
- Docker + Docker Compose установлены
- Открытый интернет (не нужен публичный IP/домен — бот работает по long polling)

---

## Шаг 1 — Клонируй репозиторий

```bash
git clone https://github.com/nojkinrs124/family-assistant.git
cd family-assistant
```

---

## Шаг 2 — Создай .env

```bash
cp .env.example .env
nano .env
```

Заполни:
```
TELEGRAM_BOT_TOKEN=...        # от @BotFather
OPENROUTER_API_KEY=...        # от openrouter.ai
SUPABASE_URL=https://ofoxcgswiucxatmtjgsz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=... # Dashboard → Settings → API → service_role
OPENROUTER_MODEL=openai/gpt-4o-mini
```

---

## Шаг 3 — Первичная авторизация в Ленте

Это делается **один раз**. Нужен дисплей (Xvfb + VNC или локальная машина).

### Вариант А: на своём компьютере (проще)

```bash
# На своей машине (не VPS):
cd mcp-servers/lenta-mcp
npm install
node auth-interactive.js
# Браузер откроется, логинись вручную
# После Enter — сессия сохранится в session-state.json
```

Потом скопируй сессию на VPS:
```bash
scp mcp-servers/lenta-mcp/session-state.json user@vps:/home/user/session-state.json
```

### Вариант Б: прямо на VPS через Xvfb + VNC

```bash
# На VPS:
apt install -y xvfb x11vnc
Xvfb :99 -screen 0 1280x720x24 &
x11vnc -display :99 -nopw -listen localhost &

# На своей машине — SSH-туннель:
ssh -L 5900:localhost:5900 user@your-vps

# Подключись любым VNC-клиентом к localhost:5900, затем на VPS:
cd ~/family-assistant/mcp-servers/lenta-mcp
npm install
DISPLAY=:99 LENTA_SESSION_FILE=./session-state.json node auth-interactive.js
```

---

## Шаг 4 — Положи сессию в docker volume

```bash
# Создаём volume и копируем сессию
docker volume create family-assistant_lenta-session

docker run --rm \
  -v family-assistant_lenta-session:/data \
  -v /path/to/session-state.json:/src/session-state.json:ro \
  alpine cp /src/session-state.json /data/session-state.json

echo "Сессия скопирована в volume"
```

---

## Шаг 5 — Запуск

```bash
docker compose up -d --build

# Проверяем логи:
docker compose logs -f telegram-bot
```

Бот должен ответить `/start` в Telegram.

---

## Шаг 6 — Обновление кода

```bash
git pull
docker compose up -d --build
```

---

## Переавторизация в Ленте

Сессия живёт ~30 дней. Когда протухнет, бот вернёт ошибку "Нет сессии".

```bash
# Повтори Шаг 3, потом обнови volume:
docker run --rm \
  -v family-assistant_lenta-session:/data \
  -v /path/to/new-session-state.json:/src/session-state.json:ro \
  alpine cp /src/session-state.json /data/session-state.json

docker compose restart telegram-bot
```

---

## Мониторинг

```bash
# Статус
docker compose ps

# Логи в реальном времени
docker compose logs -f

# Перезапуск после падения (настроен restart: unless-stopped)
docker compose restart telegram-bot
```
