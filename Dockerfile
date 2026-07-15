# Node 24 — precisamos de Node >= 22.5 pro SQLite nativo (node:sqlite).
FROM node:24-bookworm-slim

WORKDIR /app

# Instala dependências primeiro (aproveita cache de camada do Docker).
COPY package*.json ./
RUN npm install

# Instala o Chromium do Playwright + libs de sistema que ele precisa.
RUN npx playwright install --with-deps chromium

# Copia o resto do código.
COPY . .

# Pasta do banco SQLite (montada como volume no compose pra persistir).
RUN mkdir -p /app/data

# Entrypoint que sincroniza o SQLite com o file share (ver entrypoint.sh).
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production

# No Azure (job efêmero) o entrypoint cuida do banco no file share.
# Em VPS/local com disco persistente, dá pra usar direto `npm run start`.
CMD ["/app/entrypoint.sh"]
