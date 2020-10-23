FROM node:14-buster-slim

WORKDIR /app/source

COPY package.json .

RUN npm install && npm install typescript

ADD . /app/source

RUN npx tsc

CMD [ "npm", "start" ]
EXPOSE 3000
