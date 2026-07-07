import { Cron } from "croner";
import { jobs } from "./jobs";
import { cleanupOldLogs, getLogDir } from "./lib/log";
import { runJobSafely } from "./safe-run";

const TIMEZONE = "Asia/Tokyo";

// 未捕捉 rejection で常駐プロセスを落とさず、ログのみ残して常駐を維持する
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

// ログローテーション（LOG_DIR が設定されている場合のみ）
if (getLogDir()) {
  try {
    const deleted = await cleanupOldLogs();
    if (deleted > 0) {
      console.log(`log cleanup: deleted ${deleted} old log file(s)`);
    }
  } catch (error) {
    console.warn("log cleanup failed:", error);
  }
}

for (const job of jobs) {
  new Cron(
    job.schedule,
    { name: job.name, timezone: TIMEZONE, protect: true },
    () => runJobSafely(job),
  );
  console.log(`registered: ${job.name} (${job.schedule})`);
}

console.log(`cron started with ${jobs.length} job(s), tz=${TIMEZONE}`);
