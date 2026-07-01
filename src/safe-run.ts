import type { Job } from "./types";

// ジョブの run を try-catch でラップし、例外を常駐プロセス外へ伝播させない
export async function runJobSafely(job: Job): Promise<void> {
  try {
    await job.run();
  } catch (error) {
    console.error(`[${job.name}] failed:`, error);
  }
}
