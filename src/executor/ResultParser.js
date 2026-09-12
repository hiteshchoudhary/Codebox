import { getStatusById } from '../languages/index.js';

class ResultParser {
  /**
   * Parse execution result and determine status
   * @param {object} result - Raw execution result
   * @param {object} submission - Original submission
   * @returns {object} Parsed result with status
   */
  parse(result, submission) {
    const { exitCode, stdout, stderr, wallTime, time, memory, timedOut } = result;

    // Determine status based on execution result
    let status;
    let exitSignal = null;

    if (timedOut) {
      status = getStatusById(5); // Time Limit Exceeded
    } else if (exitCode === 0) {
      status = getStatusById(3); // Accepted
    } else if (exitCode === 137 || exitCode === 9) {
      // Killed by SIGKILL (out of memory or timeout)
      status = getStatusById(5); // Time Limit Exceeded
      exitSignal = 9;
    } else if (exitCode === 139 || exitCode === 11) {
      // SIGSEGV
      status = getStatusById(7); // Runtime Error (SIGSEGV)
      exitSignal = 11;
    } else if (exitCode === 136 || exitCode === 8) {
      // SIGFPE
      status = getStatusById(9); // Runtime Error (SIGFPE)
      exitSignal = 8;
    } else if (exitCode === 134 || exitCode === 6) {
      // SIGABRT
      status = getStatusById(10); // Runtime Error (SIGABRT)
      exitSignal = 6;
    } else if (exitCode === 153 || exitCode === 25) {
      // SIGXFSZ
      status = getStatusById(8); // Runtime Error (SIGXFSZ)
      exitSignal = 25;
    } else if (exitCode !== 0) {
      // Non-zero exit code
      status = getStatusById(11); // Runtime Error (NZEC)
    }

    // Truncate output if too long
    const maxOutputLength = 65536;
    const truncatedStdout = this.truncate(stdout, maxOutputLength);
    const truncatedStderr = this.truncate(stderr, maxOutputLength);

    // Merge stderr to stdout if requested
    let finalStdout = truncatedStdout;
    let finalStderr = truncatedStderr;

    if (submission.redirect_stderr_to_stdout) {
      finalStdout = truncatedStdout + (truncatedStderr ? '\n' + truncatedStderr : '');
      finalStderr = null;
    }

    return {
      status,
      stdout: finalStdout || null,
      stderr: finalStderr || null,
      compile_output: null,
      time: time ? time.toFixed(3) : null,
      wall_time: wallTime ? wallTime.toFixed(3) : null,
      memory: memory || null,
      exit_code: exitCode,
      exit_signal: exitSignal,
      message: null,
    };
  }

  /**
   * Truncate string to max length
   */
  truncate(str, maxLength) {
    if (!str) return str;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '\n[truncated]';
  }

  /**
   * Parse signal number from exit code
   * Exit code = 128 + signal number
   */
  parseSignal(exitCode) {
    if (exitCode > 128) {
      return exitCode - 128;
    }
    return null;
  }
}

export default ResultParser;
