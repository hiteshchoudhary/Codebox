import { describe, it } from 'node:test';
import assert from 'node:assert';
import ResultParser from '../src/executor/ResultParser.js';

const parser = new ResultParser();

function makeSubmission(overrides = {}) {
  return {
    source_code: 'print("hello")',
    language_id: 71,
    redirect_stderr_to_stdout: false,
    ...overrides,
  };
}

describe('ResultParser', () => {
  it('should return Accepted for exit code 0', () => {
    const result = parser.parse({ exitCode: 0, stdout: 'hello', stderr: null, time: 0.1, wallTime: 0.12, memory: 1024, timedOut: false }, makeSubmission());
    assert.strictEqual(result.status.id, 3);
    assert.strictEqual(result.stdout, 'hello');
  });

  it('should return TLE when timedOut is true', () => {
    const result = parser.parse({ exitCode: 0, stdout: '', stderr: null, time: 5, wallTime: 5.1, memory: 1024, timedOut: true }, makeSubmission());
    assert.strictEqual(result.status.id, 5);
  });

  it('should return TLE for SIGKILL (exit 137)', () => {
    const result = parser.parse({ exitCode: 137, stdout: '', stderr: null, time: null, wallTime: null, memory: null, timedOut: false }, makeSubmission());
    assert.strictEqual(result.status.id, 5);
    assert.strictEqual(result.exit_signal, 9);
  });

  it('should return SIGSEGV for exit 139', () => {
    const result = parser.parse({ exitCode: 139, stdout: '', stderr: null, time: null, wallTime: null, memory: null, timedOut: false }, makeSubmission());
    assert.strictEqual(result.status.id, 7);
    assert.strictEqual(result.exit_signal, 11);
  });

  it('should return NZEC for other non-zero exit codes', () => {
    const result = parser.parse({ exitCode: 1, stdout: '', stderr: 'error', time: 0.1, wallTime: 0.12, memory: 512, timedOut: false }, makeSubmission());
    assert.strictEqual(result.status.id, 11);
  });

  it('should truncate long output', () => {
    const longOutput = 'x'.repeat(70000);
    const result = parser.parse({ exitCode: 0, stdout: longOutput, stderr: null, time: 0.1, wallTime: 0.12, memory: 1024, timedOut: false }, makeSubmission());
    assert(result.stdout.length < 70000);
    assert(result.stdout.endsWith('[truncated]'));
  });

  it('should redirect stderr to stdout when requested', () => {
    const result = parser.parse(
      { exitCode: 1, stdout: 'out', stderr: 'err', time: 0.1, wallTime: 0.12, memory: 512, timedOut: false },
      makeSubmission({ redirect_stderr_to_stdout: true }),
    );
    assert(result.stdout.includes('out'));
    assert(result.stdout.includes('err'));
    assert.strictEqual(result.stderr, null);
  });

  it('should handle null stdout/stderr', () => {
    const result = parser.parse({ exitCode: 0, stdout: null, stderr: null, time: 0.1, wallTime: 0.12, memory: 1024, timedOut: false }, makeSubmission());
    assert.strictEqual(result.stdout, null);
    assert.strictEqual(result.stderr, null);
  });
});
