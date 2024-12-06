FROM node:16-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY main.js .

EXPOSE 8000
CMD ["node", "main.js"]
