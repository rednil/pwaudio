FROM node:12-alpine
MAINTAINER Christian Linder <rednil@github.com>

EXPOSE 80
COPY . /
RUN npm install && npm run build:static && rm -rf node_modules
RUN cd server && npm install

CMD ["/usr/local/bin/node","./server/index.js"]
