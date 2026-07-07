import type { JobLogEntry } from "./lib/log";
import { appendJobLog, getLogDir } from "./lib/log";
import type { Job, JobResult } from "./types";

// ジョブの run を try-catch でラップし、例外を常駐プロセス外へ伝播させない
export async function runJobSafely(job: Job): Promise<void> {
  const startedAt = new Date();
  let status: JobLogEntry["status"] = "success";
  let errorMessage: string | undefined;
  let result: JobResult | undefined;

  try {
    result = (await job.run()) ?? undefined;
    if (result) {
      status = result.status;
    }
  } catch (error) {
    status = "failure";
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${job.name}] failed:`, error);
  }

  const finishedAt = new Date();
  const logDir = getLogDir();
  if (logDir) {
    const entry: JobLogEntry = {
      jobName: job.name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      status,
    };

    if (errorMessage) {
      entry.error = errorMessage;
    }
    if (result?.skipReason) {
      entry.skipReason = result.skipReason;
    }
    if (result?.outputPath) {
      entry.outputPath = result.outputPath;
    }

    await appendJobLog(entry).catch((writeError) => {
      console.warn(`[${job.name}] log write failed:`, writeError);
    });
  }
}
