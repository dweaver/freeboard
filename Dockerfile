FROM mhart/alpine-node:4.4

ARG HOME=/app

ENV LANG=C.UTF-8 \
    TERM=xterm \
    HOME="${HOME}" \
    PATH="${HOME}/bin:${PATH}" \
    PORT=8080

# Install packages
RUN apk add --update nginx && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /app/nginx && \
    mkdir -p /app/build && \
    mkdir -p /app/src && \
    mkdir -p /app/bin

# We want to use bower and grunt from the command line, so need to install globally
# and not via package.json before switching to the user context
RUN npm install --global grunt-cli

# Do all work from here
WORKDIR $HOME

# copy src files
COPY . src

# Override to your own local UID:GID if need be for volume mounting.
ARG UID=1001
ARG GID=0

# Create application user and fix perms.
RUN addgroup -g $GID app 2> /dev/null; \
    GROUP=$(getent group $GID | cut -d: -f1); \
    adduser -D -u $UID -G $GROUP -h $HOME -g app -s /bin/sh app && \
    chown -R $UID:$GID . && \
    chmod -R g=rwX,o= .

# Switch to user context
USER $UID:$GID

# Since runtime variables are being defined at build time during preprocess:$env
# we are going to build all 3 environments upfront and symlink the correct index.html
# file at runtime (see: bin/entrypoint.sh)
RUN cd src && npm -q install && \
    grunt prod && mv index.html ../build/index.html.prod && \
    grunt env:staging preprocess:staging && mv index.html ../build/index.html.staging && \
    grunt env:dev preprocess:dev && mv index.html ../build/index.html.dev && \
    mv plugins ../build/plugins && \
    mv css ../build/css && \
    mv js ../build/js && \
    mv img ../build/img

# Prepare nginx.
RUN mkdir -p nginx/logs nginx/run nginx/tmp && \
    ln -s ~/build nginx && \
    ln -s /etc/nginx/mime.types nginx && \
    ln -s /usr/lib/nginx/modules nginx && \
    mv src/nginx/nginx.conf nginx && \
    mv src/bin/entrypoint.sh bin && \
    sed -i "s,\$PORT,$PORT,g" nginx/nginx.conf && \
    chmod -R g=rwX,o= nginx

EXPOSE $PORT

ENTRYPOINT ["entrypoint.sh"]
CMD ["run"]
