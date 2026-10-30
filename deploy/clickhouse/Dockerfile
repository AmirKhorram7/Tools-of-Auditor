# Local ClickHouse image. FROM python:3.13-slim which is already on this machine
# (public.ecr.aws tag). Docker Hub / GCR pulls of clickhouse/clickhouse-server
# TLS-time-out here; building once from the cached base does not re-download
# python:3.13-slim. Later `compose up --no-build` reuses ta_code-clickhouse:local.
FROM python:3.13-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

# Standalone binary (server + client in one file). Version pin so rebuilds
# do not surprise us; the tarball is cached in BuildKit after the first fetch.
ARG CH_VER=24.8.14.39
RUN mkdir -p /opt/clickhouse /var/lib/clickhouse /var/log/clickhouse-server /etc/clickhouse-server \
    && curl -fsSL "https://packages.clickhouse.com/tgz/stable/clickhouse-common-static-${CH_VER}-amd64.tgz" \
        -o /tmp/ch.tgz \
    && tar -xzf /tmp/ch.tgz -C /opt/clickhouse --strip-components=1 \
    && rm /tmp/ch.tgz \
    && ln -sf /opt/clickhouse/usr/bin/clickhouse /usr/bin/clickhouse \
    && ln -sf /usr/bin/clickhouse /usr/bin/clickhouse-client \
    && ln -sf /usr/bin/clickhouse /usr/bin/clickhouse-server

COPY config.xml /etc/clickhouse-server/config.xml
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh /etc/clickhouse-server/config.xml \
    && chmod +x /entrypoint.sh

EXPOSE 8123 9000
VOLUME /var/lib/clickhouse

ENTRYPOINT ["/entrypoint.sh"]
