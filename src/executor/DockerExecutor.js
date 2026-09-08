import Docker from 'dockerode';
import config from '../utils/config.js';
import logger from '../utils/logger.js';
import { getStatusById } from '../languages/index.js';
import ResultParser from './ResultParser.js';

const MULTI_FILE_LANGUAGE_ID = 89;

class DockerExecutor {
  constructor() {
    this.docker = new Docker({ socketPath: config.docker.socketPath });
    this.resultParser = new ResultParser();
  }

  /**
   * Execute a submission
   * @param {object} submission - The submission object
   * @returns {object} Execution result
   */
  async execute(submission) {
    const { language } = submission;
    let container = null;

    try {
      // Create container with security limits
      container = await this.createContainer(submission);

      // Start container
      await container.start();

      if (language.id === MULTI_FILE_LANGUAGE_ID) {
        // Multi-file program: extract ZIP, then run compile/run scripts
        await this.copyAdditionalFiles(container, submission);
        return await this.executeMultiFile(container, submission);
      }

      // Copy source code to container
      await this.copySourceCode(container, submission);

      // Copy additional files if provided
      if (submission.additional_files) {
        await this.copyAdditionalFiles(container, submission);
      }

      // If compiled language, run compilation first
      if (language.compile_cmd) {
        const compileResult = await this.runCommand(
          container,
          language.compile_cmd,
          submission.compiler_options,
          submission.cpu_time_limit + submission.cpu_extra_time,
          ''
        );

        if (compileResult.exitCode !== 0) {
          return {
            status: getStatusById(6), // Compilation Error
            compile_output: compileResult.stderr || compileResult.stdout,
            time: null,
            wall_time: null,
            memory: null,
            stdout: null,
            stderr: null,
            exit_code: compileResult.exitCode,
            exit_signal: null,
          };
        }
      }

      // Run the program
      const runCmd = this.buildRunCommand(language.run_cmd, submission.command_line_arguments);
      const result = await this.runCommand(
        container,
        runCmd,
        null,
        submission.wall_time_limit,
        submission.stdin
      );

      // Parse and return result
      return this.resultParser.parse(result, submission);
    } catch (error) {
      logger.error({
        event: 'execution_error',
        token: submission.token,
        error: error.message,
      });

      return {
        status: getStatusById(13), // Internal Error
        message: error.message,
        time: null,
        wall_time: null,
        memory: null,
        stdout: null,
        stderr: null,
        compile_output: null,
        exit_code: null,
        exit_signal: null,
      };
    } finally {
      // Cleanup container
      if (container) {
        try {
          await container.stop({ t: 1 }).catch(() => {});
          await container.remove({ force: true });
        } catch (err) {
          logger.warn({ err }, 'Failed to cleanup container');
        }
      }
    }
  }

  /**
   * Execute a multi-file program (language_id 89)
   */
  async executeMultiFile(container, submission) {
    // Verify /box/run script exists
    const checkRun = await this.runCommand(container, 'test -f /box/run', null, 5, '');
    if (checkRun.exitCode !== 0) {
      return {
        status: getStatusById(6), // Compilation Error (used for setup errors)
        compile_output: 'Multi-file program requires a "run" script in the ZIP archive',
        time: null,
        wall_time: null,
        memory: null,
        stdout: null,
        stderr: null,
        exit_code: null,
        exit_signal: null,
      };
    }

    // If /box/compile exists, run it
    const checkCompile = await this.runCommand(container, 'test -f /box/compile', null, 5, '');
    if (checkCompile.exitCode === 0) {
      const compileResult = await this.runCommand(
        container,
        'bash /box/compile',
        null,
        submission.cpu_time_limit + submission.cpu_extra_time,
        ''
      );

      if (compileResult.exitCode !== 0) {
        return {
          status: getStatusById(6), // Compilation Error
          compile_output: compileResult.stderr || compileResult.stdout,
          time: null,
          wall_time: null,
          memory: null,
          stdout: null,
          stderr: null,
          exit_code: compileResult.exitCode,
          exit_signal: null,
        };
      }
    }

    // Run the program
    const result = await this.runCommand(
      container,
      'bash /box/run',
      null,
      submission.wall_time_limit,
      submission.stdin
    );

    return this.resultParser.parse(result, submission);
  }

  /**
   * Create a Docker container with security limits
   */
  async createContainer(submission) {
    const { language, memory_limit, max_processes_and_or_threads, enable_network } = submission;

    // Use at least the language's minimum memory (e.g. tsc needs ~400MB)
    const effectiveMemory = Math.max(memory_limit, language.min_memory || 0);

    const boxSize = Math.max(Math.ceil(effectiveMemory / 1024), 128); // at least 128MB for /box

    const containerConfig = {
      Image: language.image,
      Cmd: ['/bin/sh', '-c', 'sleep 3600'], // Keep container alive
      WorkingDir: '/box',
      // User is set in Dockerfile for each language image
      NetworkDisabled: !enable_network,
      HostConfig: {
        Memory: effectiveMemory * 1024, // Convert KB to bytes
        MemorySwap: effectiveMemory * 1024, // Disable swap
        CpuPeriod: 100000,
        CpuQuota: 100000, // 1 CPU
        PidsLimit: max_processes_and_or_threads,
        NetworkMode: enable_network ? 'bridge' : 'none',
        ReadonlyRootfs: true,
        SecurityOpt: ['no-new-privileges'],
        CapDrop: ['ALL'],
        MaskedPaths: [
          '/etc/passwd', '/etc/shadow', '/etc/group', '/etc/gshadow',
          '/etc/hostname', '/etc/hosts', '/etc/resolv.conf',
          '/proc/kcore', '/proc/keys', '/proc/latency_stats',
          '/proc/timer_list', '/proc/timer_stats', '/proc/sched_debug',
          '/proc/scsi', '/proc/acpi', '/proc/bus',
          '/proc/1/environ', '/proc/1/cmdline', '/proc/1/maps',
          '/sys/firmware', '/sys/devices',
        ],
        ReadonlyPaths: ['/proc', '/sys'],
        // mode=1777 is required: every language image runs as a non-root user
        // (see docker/images/*/Dockerfile), and a tmpfs defaults to root-owned
        // 0755 — without this the sandbox user cannot write its source file or
        // its compile artifacts into /box.
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=64m,mode=1777',
          '/box': `rw,exec,nosuid,size=${boxSize}m,mode=1777`,
          '/home': 'rw,noexec,nosuid,size=16m,mode=1777',
        },
        Binds: [],
      },
      Tty: false,
      OpenStdin: true,
      StdinOnce: true,
    };

    return await this.docker.createContainer(containerConfig);
  }

  /**
   * Copy source code into the container
   */
  async copySourceCode(container, submission) {
    const { language, source_code } = submission;

    await this.writeFileToBox(container, language.source_file, source_code);
  }

  /**
   * Write a single file into /box from inside the container.
   *
   * putArchive() cannot be used for this. Docker resolves archive destination
   * paths against the container's rootfs and does not follow tmpfs mounts, so
   * an archive sent to /box is extracted into the rootfs directory that the
   * tmpfs is mounted over -- invisible to any process in the container. With
   * ReadonlyRootfs set, the daemon refuses the write outright:
   *   (HTTP code 400) container rootfs is marked read-only
   * Piping the content in over exec stdin writes to the real tmpfs instead, and
   * works while the rootfs stays read-only.
   */
  async writeFileToBox(container, fileName, content) {
    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

    // File names come from the language config, never from user input.
    const result = await this.runCommand(
      container,
      `base64 -d > '/box/${fileName}'`,
      null,
      30,
      contentBuffer.toString('base64')
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to write ${fileName} into container: ${result.stderr || `exit code ${result.exitCode}`}`
      );
    }
  }

  /**
   * Copy additional files (base64-encoded ZIP) into the container
   */
  async copyAdditionalFiles(container, submission) {
    const { additional_files } = submission;

    try {
      const zipBuffer = Buffer.from(additional_files, 'base64');

      await this.writeFileToBox(container, '_additional.zip', zipBuffer);

      // Check for path traversal and extract ZIP inside container
      const checkResult = await this.runCommand(
        container,
        'unzip -l /box/_additional.zip | grep -q "\\.\\./\\|/\\.\\." && echo TRAVERSAL_FOUND || echo OK',
        null,
        10,
        ''
      );

      if (checkResult.stdout.trim().includes('TRAVERSAL_FOUND')) {
        await this.runCommand(container, 'rm /box/_additional.zip', null, 5, '');
        throw new Error('ZIP archive contains path traversal entries');
      }

      const extractResult = await this.runCommand(
        container,
        'unzip -n -qq /box/_additional.zip -d /box && rm /box/_additional.zip',
        null,
        10,
        ''
      );

      if (extractResult.exitCode !== 0) {
        throw new Error(extractResult.stderr || 'Failed to extract ZIP archive');
      }

      logger.info({
        event: 'additional_files_copied',
        token: submission.token,
        size: zipBuffer.length,
      });
    } catch (error) {
      logger.error({
        event: 'additional_files_copy_failed',
        token: submission.token,
        error: error.message,
      });
      throw new Error(`Failed to copy additional files: ${error.message}`);
    }
  }

  /**
   * Build run command with arguments
   */
  buildRunCommand(baseCmd, args) {
    if (!args) return baseCmd;
    return `${baseCmd} ${args}`;
  }

  /**
   * Run a command inside the container
   */
  async runCommand(container, command, extraOptions, timeoutSecs, stdin) {
    const startTime = Date.now();

    // Create exec instance
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!stdin,
      WorkingDir: '/box',
    });

    return new Promise((resolve, reject) => {
      const timeoutMs = timeoutSecs * 1000;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        // Kill the container to stop execution
        container.kill().catch(() => {});
      }, timeoutMs);

      exec.start({ hijack: true, stdin: !!stdin }, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }

        // Send stdin if provided
        if (stdin) {
          stream.write(stdin);
          stream.end();
        }

        // Demux stdout and stderr
        const stdoutChunks = [];
        const stderrChunks = [];

        stream.on('data', (chunk) => {
          // Docker multiplexes stdout/stderr with 8-byte header
          // Header: [stream type (1 byte), 0, 0, 0, size (4 bytes)]
          let offset = 0;
          while (offset < chunk.length) {
            if (offset + 8 > chunk.length) break;

            const streamType = chunk[offset];
            const size = chunk.readUInt32BE(offset + 4);

            if (offset + 8 + size > chunk.length) break;

            const data = chunk.slice(offset + 8, offset + 8 + size);

            if (streamType === 1) {
              stdoutChunks.push(data);
            } else if (streamType === 2) {
              stderrChunks.push(data);
            }

            offset += 8 + size;
          }
        });

        stream.on('end', async () => {
          clearTimeout(timeout);

          stdout = Buffer.concat(stdoutChunks).toString('utf-8');
          stderr = Buffer.concat(stderrChunks).toString('utf-8');

          const endTime = Date.now();
          const wallTime = (endTime - startTime) / 1000;

          // Get exit code
          let exitCode = 0;
          try {
            const inspection = await exec.inspect();
            exitCode = inspection.ExitCode;
          } catch (e) {
            exitCode = timedOut ? 124 : -1;
          }

          resolve({
            stdout,
            stderr,
            exitCode,
            wallTime,
            time: wallTime, // Approximate CPU time
            memory: null, // Would need cgroup stats for accurate memory
            timedOut,
          });
        });

        stream.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  }
}

export default DockerExecutor;
