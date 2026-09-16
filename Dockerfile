# Tauditor Django API — production image
#base image 
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=15 \
    PIP_ROOT_USER_ACTION=ignore

# this is a working directory for the app.
WORKDIR /app

# curl = healthcheck. fonts-dejavu = Farsi-capable PDF export (reportlab).
RUN apt-get update \
    && apt-get install -y --no-install-recommends --fix-missing curl fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# pip in python:3.13-slim is already current — do not "upgrade pip" (it hits pypi.org
# first and often burns the retry budget on slow/filtered production networks).
# Override the index from compose/.env when pypi.org times out:
#   PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
#   PIP_TRUSTED_HOST=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=pypi.org
ENV PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}
RUN pip install -r requirements.txt \
    || (sleep 8 && pip install -r requirements.txt) \
    || (sleep 15 && pip install -r requirements.txt)

# App source, including the 18 character portrait ids on Profile.
COPY . .

RUN chmod +x /app/deploy/backend/entrypoint.sh \
    && mkdir -p /app/media /app/staticfiles

# this is the port that the app will run on.
EXPOSE 8000

# this is the entrypoint for the app.
ENTRYPOINT ["/app/deploy/backend/entrypoint.sh"]
