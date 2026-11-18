FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/interview/package*.json ./services/interview/
RUN cd services/interview && npm ci --omit=dev

COPY services/interview ./services/interview
COPY shared ./shared

WORKDIR /app/services/interview

EXPOSE 8003

CMD ["npm", "start"]
