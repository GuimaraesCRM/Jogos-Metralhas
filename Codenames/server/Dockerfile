# Imagem do servidor de salas. O contexto de build e a raiz do projeto, porque
# o servidor importa as regras de shared/ — elas existem em uma versao so.
FROM node:22-alpine

WORKDIR /app

# O package.json do servidor vira o package.json da raiz da imagem: assim tanto
# server/ quanto shared/ sao resolvidos como modulos ES.
COPY server/package.json ./package.json
RUN npm install --omit=dev

COPY shared ./shared
COPY server ./server

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/index.js"]
