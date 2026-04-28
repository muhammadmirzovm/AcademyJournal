FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Daphne serves both HTTP and WebSocket (ASGI)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]
