# Imagem do servidor de partidas. O contexto de build e a raiz do jogo
# (MetralhasStrikeBlock/), porque o servidor importa fisica, regras e mapa de
# shared/ — elas existem em uma versao so.
FROM node:22-alpine

WORKDIR /app

# O package.json do servidor vira o package.json da raiz da imagem: assim tanto
# server/ quanto shared/ sao resolvidos como modulos ES.
COPY server/package.json ./package.json
RUN npm install --omit=dev

COPY shared ./shared
COPY server ./server

ENV PORT=8790
EXPOSE 8790

CMD ["node", "server/index.js"]
