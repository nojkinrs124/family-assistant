FROM node:22-slim

# Playwright зависимости (нужны для запуска child-process lenta-mcp)
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 \
    libasound2 libpango-1.0-0 libcairo2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

CMD ["node", "src/index.js"]
