# Tauditor Django API — production image
#base image 
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# this is a working directory for the app.
WORKDIR /app

# curl = healthcheck. fonts-dejavu = Farsi-capable PDF export (reportlab).
RUN apt-get update \
    && apt-get install -y --no-install-recommends --fix-missing curl fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

RUN chmod +x /app/deploy/backend/entrypoint.sh \
    && mkdir -p /app/media /app/staticfiles

# this is the port that the app will run on.
EXPOSE 8000

# this is the entrypoint for the app.
ENTRYPOINT ["/app/deploy/backend/entrypoint.sh"]
