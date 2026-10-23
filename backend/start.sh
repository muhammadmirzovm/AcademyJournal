#!/bin/sh
exec uvicorn backend.asgi:application --host 0.0.0.0 --port 8000 --lifespan off
