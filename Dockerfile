FROM node:21-alpine3.18

WORKDIR /src

COPY . .

RUN npm install
RUN npx tsc

EXPOSE 3000
EXPOSE 8080

CMD ["node", "dist/index.js"]
