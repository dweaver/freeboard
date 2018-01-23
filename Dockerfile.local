FROM mhart/alpine-node:4.4
RUN apk add --update nginx git && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /tmp/nginx/client-body && \
    mkdir -p /app && \
    mkdir -p /var/cache/nginx/ && \
    chmod -R 777 /app /var /var/run /var/log/nginx /var/cache/nginx/

WORKDIR /app

# We want to use bower and grunt from the command line,
# so need to install globally and not via package.json
RUN npm install --global grunt-cli

COPY package.json ./package.json

# now install dependencies and build
RUN npm -q install

COPY . /app
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/mime.types /etc/nginx/mime.types
RUN grunt dev_server
RUN rm -rf node_modules && \
    rm -rf tmp && \
    chmod 644 /etc/nginx/* && \
    mv * /var/www

EXPOSE 8080 8443

CMD ["nginx", "-g", "daemon off;"]
