export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnOptions {
  timeout?: number;
  cwd?: string;
}

export class SpawnError extends Error {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;

  constructor(
    message: string,
    stdout: string,
    stderr: string,
    exitCode: number,
  ) {
    super(message);
    this.name = "SpawnError";
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class SpawnTimeoutError extends SpawnError {
  constructor(message: string, stdout: string, stderr: string) {
    super(message, stdout, stderr, -1);
    this.name = "SpawnTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
const SIGKILL_GRACE_MS = 1_000;
const STREAM_DRAIN_MS = 500;

async function readWithTimeout(
  promise: Promise<string>,
  ms: number,
): Promise<string> {
  return Promise.race([
    promise,
    new Promise<string>((r) => setTimeout(() => r(""), ms)),
  ]);
}

export async function spawn(
  cmd: string[],
  opts?: SpawnOptions,
): Promise<SpawnResult> {
  const timeoutMs = opts?.timeout ?? DEFAULT_TIMEOUT_MS;

  const proc = Bun.spawn(cmd, {
    cwd: opts?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutPromise = new Response(proc.stdout).text();
  const stderrPromise = new Response(proc.stderr).text();

  const exitedWithTimeout = await Promise.race([
    proc.exited.then((code) => ({ timedOut: false as const, code })),
    new Promise<{ timedOut: true }>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ timedOut: true });
      }, timeoutMs);
      proc.exited.then(() => {
        clearTimeout(timer);
      });
    }),
  ]);

  if (exitedWithTimeout.timedOut) {
    proc.kill();
    const killed = await Promise.race([
      proc.exited.then(() => true),
      new Promise<false>((r) => setTimeout(() => r(false), SIGKILL_GRACE_MS)),
    ]);
    if (!killed) {
      proc.kill(9);
      await proc.exited;
    }
    const [stdout, stderr] = await Promise.all([
      readWithTimeout(stdoutPromise, STREAM_DRAIN_MS),
      readWithTimeout(stderrPromise, STREAM_DRAIN_MS),
    ]);
    throw new SpawnTimeoutError(
      `Command timed out after ${timeoutMs}ms: ${cmd.join(" ")}`,
      stdout,
      stderr,
    );
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  const exitCode = exitedWithTimeout.code;

  if (exitCode !== 0) {
    throw new SpawnError(
      `Command failed with exit code ${exitCode}: ${cmd.join(" ")}`,
      stdout,
      stderr,
      exitCode,
    );
  }

  return { stdout, stderr, exitCode };
}
