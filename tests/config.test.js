import { describe, it } from 'node:test';
import assert from 'node:assert';
import config from '../src/utils/config.js';

describe('Config', () => {
  it('should have cors section with allowedOrigins array', () => {
    assert(Array.isArray(config.cors.allowedOrigins));
  });

  it('should have trustProxy as string', () => {
    assert.strictEqual(typeof config.trustProxy, 'string');
  });

  it('should have auth section with tokens and headers', () => {
    assert(Array.isArray(config.auth.tokens));
    assert(Array.isArray(config.auth.headers));
    assert(config.auth.headers.length > 0);
  });

  it('should have all execution limits defined', () => {
    assert.strictEqual(typeof config.execution.defaultCpuTimeLimit, 'number');
    assert.strictEqual(typeof config.execution.maxCpuTimeLimit, 'number');
    assert.strictEqual(typeof config.execution.defaultMemoryLimit, 'number');
    assert.strictEqual(typeof config.execution.maxMemoryLimit, 'number');
    assert.strictEqual(typeof config.execution.defaultStackLimit, 'number');
    assert.strictEqual(typeof config.execution.compileCpuTimeLimit, 'number');
    assert.strictEqual(typeof config.execution.compileWallTimeLimit, 'number');
  });

  it('should have reasonable defaults', () => {
    assert(config.execution.defaultCpuTimeLimit > 0);
    assert(config.execution.maxCpuTimeLimit >= config.execution.defaultCpuTimeLimit);
    assert(config.execution.maxMemoryLimit >= config.execution.defaultMemoryLimit);
    assert(config.server.port > 0);
    assert(config.cache.resultTtl > 0);
  });
});
