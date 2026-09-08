FROM gcc:9

# Create non-root user (use UID 1001 to avoid conflicts)
RUN useradd -m -u 1001 -s /bin/bash runner

# Create working directory
RUN mkdir -p /box && chown runner:runner /box

# Install additional tools.
# gcc:9 is built on Debian 11 (bullseye), which reached end-of-life — its
# security repo now serves an expired Release file and plain `apt-get update`
# exits 100, breaking ./scripts/build-images.sh. Accept the expired metadata;
# the packages themselves are still served and signature checking stays on.
RUN apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends \
    time \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /box

# Switch to non-root user
USER runner

# Keep container alive (will be overridden at runtime)
CMD ["sleep", "infinity"]
