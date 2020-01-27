FROM node:12-alpine
MAINTAINER Christian Linder <rednil@github.com>

EXPOSE 80
COPY . /
ENV NODE_ENV production
CMD ["/usr/local/bin/node","./server/index.js"]
