# Use a lightweight Python image to minimize storage
FROM python:3.12-slim

# Set working directory inside container
WORKDIR /app

# Install minimal system dependencies required for OpenCV and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user and group
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --no-create-home appuser

# Copy requirements file first to leverage Docker cache
COPY --chown=appuser:appgroup requirements.txt .

# FORCE CPU-only PyTorch BEFORE installing requirements to prevent downloading 2.5GB CUDA binaries
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source code
COPY --chown=appuser:appgroup . .

# Ensure app-writable directories exist and have correct ownership
RUN mkdir -p /app/storage_files && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Start FastAPI server
CMD [ "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000" ]