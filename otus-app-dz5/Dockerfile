FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY main.js ./

EXPOSE 8000
EXPOSE 9090

CMD ["node", "main.js"]
