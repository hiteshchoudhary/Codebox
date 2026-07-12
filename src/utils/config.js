const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    bodyLimit: process.env.BODY_LIMIT || '5mb',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  auth: {
    tokens: (process.env.AUTH_TOKEN || '').split(' ').filter(Boolean),
    headers: (process.env.AUTH_HEADERS || 'X-Auth-Token x-rapidapi-key').split(' ').filter(Boolean),
  },

  execution: {
    defaultCpuTimeLimit: parseInt(process.env.DEFAULT_CPU_TIME_LIMIT) || 5,
    maxCpuTimeLimit: parseInt(process.env.MAX_CPU_TIME_LIMIT) || 15,
    defaultWallTimeLimit: parseInt(process.env.DEFAULT_WALL_TIME_LIMIT) || 10,
    maxWallTimeLimit: parseInt(process.env.MAX_WALL_TIME_LIMIT) || 30,
    defaultMemoryLimit: parseInt(process.env.DEFAULT_MEMORY_LIMIT) || 128000,
    maxMemoryLimit: parseInt(process.env.MAX_MEMORY_LIMIT) || 512000,
    maxProcesses: parseInt(process.env.MAX_PROCESSES) || 60,
    maxSourceSize: parseInt(process.env.MAX_SOURCE_SIZE) || 65536,
    maxAdditionalFilesSize: parseInt(process.env.MAX_ADDITIONAL_FILES_SIZE) || 2097152, // 2MB base64
    defaultStackLimit: parseInt(process.env.DEFAULT_STACK_LIMIT) || 64000,
    compileCpuTimeLimit: parseInt(process.env.COMPILE_CPU_TIME_LIMIT) || 15,
    compileWallTimeLimit: parseInt(process.env.COMPILE_WALL_TIME_LIMIT) || 30,
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 4,
  },

  cache: {
    resultTtl: parseInt(process.env.RESULT_CACHE_TTL) || 3600,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  docker: {
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    containerTimeout: parseInt(process.env.CONTAINER_TIMEOUT) || 30000,
  },

  executor: {
    // 'auto' | 'isolate' | 'firecracker' | 'docker'
    // auto: prefers isolate > firecracker > docker
    type: process.env.EXECUTOR_TYPE || 'auto',
  },

  firecracker: {
    baseDir: process.env.FC_BASE_DIR || '/var/lib/codebox/firecracker',
    kernelPath: process.env.FC_KERNEL_PATH || '/var/lib/codebox/firecracker/kernels/vmlinux',
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  },

  trustProxy: process.env.TRUST_PROXY || '',
};

export default config;
