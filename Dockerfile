FROM node:18-bookworm-slim as build
WORKDIR /app/source
COPY package.json .
RUN npm install && npm install typescript
ADD . /app/source
RUN npx tsc

FROM node:18-bookworm-slim
WORKDIR /app/source
COPY --from=build /app/source /app/source
CMD [ "npm", "start" ]
EXPOSE 3000
