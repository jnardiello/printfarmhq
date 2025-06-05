# Backend Application Image
FROM python:3.11-slim AS backend-app

# Install system dependencies
# Note: SQLite client is needed for migrations, but the actual database
# runs in a separate container in production
RUN apt-get update && apt-get install -y \
    gcc \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Set Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/appuser/.local/bin:$PATH" \
    PYTHONPATH=/app

# Copy requirements
COPY --chown=appuser:appuser requirements.txt ./

# Install Python dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Make startup script executable
RUN chmod +x start.sh

# Add labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/jnardiello/printfarmhq"
LABEL org.opencontainers.image.description="PrintFarmHQ Backend - Complete 3D printing management platform"
LABEL org.opencontainers.image.licenses="AGPL"
LABEL org.opencontainers.image.title="PrintFarmHQ Backend"
LABEL org.opencontainers.image.vendor="PrintFarmHQ"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import socket; sock = socket.socket(); sock.connect(('localhost', 8000)); sock.close()"

# Run the application with migrations
CMD ["./start.sh"]