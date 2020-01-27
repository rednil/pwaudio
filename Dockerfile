FROM node:12-alpine
MAINTAINER Christian Linder <rednil@github.com>

EXPOSE 80
COPY . /

CMD ["/usr/local/bin/node","NODE_ENV=production ./server/index.js"]
