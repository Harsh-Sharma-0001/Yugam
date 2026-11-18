FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/roadmap/package*.json ./services/roadmap/
RUN cd services/roadmap && npm ci --omit=dev

COPY services/roadmap ./services/roadmap
COPY shared ./shared

WORKDIR /app/services/roadmap

EXPOSE 8004

CMD ["npm", "start"]
