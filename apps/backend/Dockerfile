# ---- Stage 1: Base Python Environment ----
FROM python:3.11-slim AS base

# Prevent Python from writing pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for psutil, building packages, and PyAutoGUI headless support
RUN apt-get update && apt-get install -y --no-install-recommends \
 gcc \
 libx11-6 \
 libxrandr2 \
 libxcomposite1 \
 libxdamage1 \
 libxfixes3 \
 libxi6 \
 libxtst6 \
 libasound2 \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create the workspace directory if it doesn't exist
RUN mkdir -p /app/workspace

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]