FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/resume/package*.json ./services/resume/
RUN cd services/resume && npm ci --omit=dev

COPY services/resume ./services/resume
COPY shared ./shared

WORKDIR /app/services/resume

EXPOSE 8002

CMD ["npm", "start"]
