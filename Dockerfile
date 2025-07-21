FROM python:3.11.13-slim-bullseye AS builder

# Set workdir
WORKDIR /usr/src/app

# Install system dependencies for building wheels
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    libatlas-base-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*


# Copy requirements first for layer caching
COPY ./requirements.txt .

# Upgrade pip and install Python dependencies
RUN python -m venv /opt/venv && \
    /opt/venv/bin/python -m pip install --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .



# Stage 2: Final runtime image
FROM python:3.11.13-slim-bullseye


# Set workdir
WORKDIR /usr/src/app

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /usr/src/app /usr/src/app/

# Activate virtual environment
ENV PATH="/opt/venv/bin:$PATH"

# Expose port
EXPOSE 8000

# Run app
CMD ["python", "main.py"]