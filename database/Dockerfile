# SQLite Database Container
FROM alpine:3.19

# Install SQLite and useful tools
RUN apk add --no-cache \
    sqlite \
    sqlite-dev \
    bash \
    busybox-extras \
    curl

# Create database directory with proper permissions
RUN mkdir -p /data && \
    chmod 755 /data

# Create a non-root user for database operations
RUN adduser -D -u 1000 dbuser && \
    chown -R dbuser:dbuser /data

# Copy initialization script
COPY --chown=dbuser:dbuser init-db.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-db.sh

# Switch to non-root user
USER dbuser

# Set working directory
WORKDIR /data

# Volume for database persistence
VOLUME ["/data"]

# Health check using SQLite
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD sqlite3 /data/hq.db "SELECT 1;" || exit 1

# Initialize database and keep container running
CMD ["/usr/local/bin/init-db.sh"]