FROM node:21-alpine3.18

WORKDIR /src

COPY . .

RUN npm install

WORKDIR /src/prisma
RUN npx prisma migrate dev --name init

WORKDIR /src
RUN npx tsc

EXPOSE 3000
EXPOSE 8080

CMD ["node", "dist/index.js"]
