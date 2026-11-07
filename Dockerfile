# Game + online save server in one container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
ENV PORT=8080 DATA_DIR=/data
VOLUME /data
EXPOSE 8080
CMD ["node", "server/server.js"]
