# Официальный образ Playwright — Chromium уже внутри, зависимости настроены
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Сначала только package.json — чтобы docker кэшировал npm install
COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

# Сессия монтируется снаружи через volume — не запекается в образ
# (session-state.json — секрет уровня пароля)
VOLUME ["/app/session"]
ENV LENTA_SESSION_FILE=/app/session/session-state.json

EXPOSE 3000
CMD ["node", "src/index.js"]
