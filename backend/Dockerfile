# Використовуємо офіційний образ Node.js
FROM node:18-alpine

# Встановлюємо робочу папку всередині контейнера
WORKDIR /app

# Копіюємо package.json, щоб встановити залежності
COPY package.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо решту коду (server.js тощо)
COPY . .

# Твій сервер працює на порту 3000
EXPOSE 3000

# Команда для запуску (з твого package.json)
CMD ["node", "server.js"]