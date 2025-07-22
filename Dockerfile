# Stage 1: Frontend build - using smaller Alpine base
FROM node:20-alpine AS frontend-builder

WORKDIR /usr/src/frontend

# Install dependencies first for better caching
COPY frontend-app/package.json frontend-app/package-lock.json ./
RUN npm ci

# Copy and build frontend
COPY frontend-app/ ./
RUN npm run build && \
    rm -rf node_modules && \
    find /usr/src/frontend/dist -name "*.map" -delete

# Stage 2: Python builder - slimmed down
FROM python:3.11.13-slim-bullseye AS python-builder

WORKDIR /usr/src/app

# Install only essential build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Stage 3: Final image - ultra slim
FROM python:3.11.13-slim-bullseye

WORKDIR /usr/src/app

# Copy only necessary files from builders
COPY --from=python-builder /opt/venv /opt/venv
COPY --from=frontend-builder /usr/src/frontend/dist ./static
COPY --from=python-builder /usr/src/app .

# Clean up Python cache and docs
RUN find /usr/local -type d -name '__pycache__' -exec rm -rf {} + && \
    find /opt/venv -type d -name '__pycache__' -exec rm -rf {} + && \
    rm -rf /usr/share/man /usr/share/doc

# Set environment
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
CMD ["python", "main.py"]