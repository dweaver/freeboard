FROM mhart/alpine-node:4.4
RUN apk add --update nginx && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /app && \
    mkdir -p /build && \
    mkdir -p /tmp/nginx && \
    mkdir -p /run/nginx && \
    mkdir -p /var/cache/nginx && \
    rm -rf /var/lib/nginx/tmp && \
    ln -sfn /tmp/nginx /var/lib/nginx/tmp

ARG HOME=/app

# Override to your own local UID:GID if need be for volume mounting.
ARG UID=1001
ARG GID=0

# default to dev environment if none provided
ENV ENVRIRONMENT=dev

WORKDIR /build

# We want to use bower and grunt from the command line,
# so need to install globally and not via package.json
RUN npm install --global grunt-cli

COPY package.json /build/package.json

# now install dependencies and build
RUN npm -q install

COPY . /build
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/mime.types /etc/nginx/mime.types
COPY bin/entrypoint.sh /usr/local/bin/entrypoint.sh

# Since runtime variables are being defined at build time during preprocess:$env
# we are going to build all 3 environments upfront and symlink the correct index.html
# file at runtime (see: bin/entrypoint.sh)
RUN grunt prod && mv index.html /app/index.html.prod && \
    grunt env:staging preprocess:staging && mv index.html /app/index.html.staging && \
    grunt env:dev preprocess:dev && mv index.html /app/index.html.dev && \
    mv ./plugins /app/plugins && \
    mv ./css /app/css && \
    mv ./js /app/js && \
    mv ./img /app/img

WORKDIR $HOME

# clean up build files
RUN rm -rf /build

# Create application user and fix perms.
RUN addgroup -g $GID app 2> /dev/null; \
    GROUP=$(getent group $GID | cut -d: -f1); \
    adduser -D -u $UID -G $GROUP -h $HOME -g app -s /bin/sh app && \
    chown -R $UID:$GID . /run/nginx /tmp/nginx /var/log/nginx /var/cache/nginx /var/lib/nginx && \
    chmod -R g=rwX,o= .

# Switch to user
USER $UID:$GID

EXPOSE 8080

ENTRYPOINT ["entrypoint.sh"]
CMD ["run"]
