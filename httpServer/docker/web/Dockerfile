FROM node:12

WORKDIR /app

COPY . .
RUN npm install
RUN npm install -g typescript 
RUN tsc

WORKDIR /app/ui
RUN npm install
RUN npm run build
RUN npm run export

WORKDIR /app

EXPOSE 3001

RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]

CMD [ "node", "./build/index.js" ]
