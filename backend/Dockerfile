# Backend Application Image
ARG REGISTRY=ghcr.io
ARG NAMESPACE=jnardiello
ARG BASE_TAG=latest

FROM ${REGISTRY}/${NAMESPACE}/printfarmhq:backend-base-${BASE_TAG} AS backend-app

# Switch to root to install packages
USER root

# Copy requirements as root
COPY --chown=appuser:appuser requirements.txt ./

# Switch back to appuser
USER appuser

# Install Python dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Set environment variables
ENV PYTHONPATH=/app

# Add labels for GitHub Container Registry
LABEL org.opencontainers.image.source="ghcr.io/jnardiello/printfarmhq"
LABEL org.opencontainers.image.description="PrintFarmHQ Backend - Complete 3D printing management platform"
LABEL org.opencontainers.image.licenses="AGPL"
LABEL org.opencontainers.image.title="PrintFarmHQ Backend"
LABEL org.opencontainers.image.vendor="PrintFarmHQ"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import socket; sock = socket.socket(); sock.connect(('localhost', 8000)); sock.close()"

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
