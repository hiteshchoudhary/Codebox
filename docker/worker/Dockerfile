FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Upstream isolate release to build. Bump deliberately, never track HEAD.
ARG ISOLATE_VERSION=v2.7

# ── 1. System packages + language runtimes ──────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    openjdk-17-jdk-headless \
    python3 \
    ca-certificates curl gnupg \
    unzip bash time \
    make git pkg-config libcap-dev libsystemd-dev libseccomp-dev \
    && rm -rf /var/lib/apt/lists/*

# ── 1a. Judge0-compatible binary path symlinks ───────────────────────────────
# Platform compile/run scripts reference Judge0-specific paths.
# Create symlinks so those paths resolve to our apt-installed binaries.
RUN mkdir -p /usr/local/gcc-9.2.0/bin \
    && ln -s /usr/bin/g++ /usr/local/gcc-9.2.0/bin/g++ \
    && ln -s /usr/bin/gcc /usr/local/gcc-9.2.0/bin/gcc \
    && ln -s /usr/lib/x86_64-linux-gnu /usr/local/gcc-9.2.0/lib64 \
    && ln -s /usr/lib/jvm/java-17-openjdk-amd64 /usr/local/jdk17

# ── 2. Node.js 20 (app runtime) ────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── 3. TypeScript compiler ──────────────────────────────────────────────────
RUN npm install -g typescript @types/node@20

# ── 3a. C++ libraries (nlohmann/json) ─────────────────────────────────────
RUN curl -fsSL https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp \
      -o /usr/local/include/json.hpp

# ── 3b. Java libraries (Gson) ────────────────────────────────────────────
RUN mkdir -p /usr/local/lib/java \
    && curl -fsSL https://repo1.maven.org/maven2/com/google/code/gson/gson/2.11.0/gson-2.11.0.jar \
       -o /usr/local/lib/java/gson.jar

# ── 4. Compile and install isolate (binaries only, skip man pages) ─────────
# Pinned: this used to clone HEAD, so an upstream change silently broke the
# image build. isolate needs libseccomp-dev (installed above) for the syscall
# restriction support it gained before v2.6 -- without it the build dies with
# "isolate.c: fatal error: seccomp.h: No such file or directory".
RUN git clone --depth 1 --branch ${ISOLATE_VERSION} https://github.com/ioi/isolate.git /tmp/isolate \
    && cd /tmp/isolate \
    && make isolate isolate-cg-keeper \
    && cp isolate isolate-cg-keeper /usr/local/bin/ \
    && chmod 4755 /usr/local/bin/isolate \
    && rm -rf /tmp/isolate \
    && mkdir -p /usr/local/etc /var/local/lib/isolate /run/isolate \
    && printf 'box_root = /var/local/lib/isolate\nlock_root = /run/isolate\ncg_root = /sys/fs/cgroup/isolate\nfirst_uid = 60000\nfirst_gid = 60000\nnum_boxes = 1000\nrestricted_init = 0\n' \
       > /usr/local/etc/isolate

# ── 5. Create runner user (for non-isolate fallback) ───────────────────────
RUN useradd -m -u 1001 -s /bin/bash runner

# ── 6. Application setup ───────────────────────────────────────────────────
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
COPY docker/worker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
