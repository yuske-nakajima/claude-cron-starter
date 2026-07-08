import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export interface StartedLogEntry {
  event: "started";
  jobName: string;
  startedAt: string;
}

export interface CompletedLogEntry {
  event: "completed";
  jobName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "success" | "failure" | "skipped";
  error?: string;
  errorStack?: string;
  skipReason?: string;
  outputPath?: string;
}

export type JobLogEntry = StartedLogEntry | CompletedLogEntry;

const DATE_JSONL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/;

/** LOG_DIR 環境変数の値を返す。未設定または空文字の場合は null */
export function getLogDir(): string | null {
  const dir = process.env.LOG_DIR;
  if (!dir) {
    return null;
  }
  return dir;
}

/** JobLogEntry を JSONL 形式でログファイルに追記する */
export async function appendJobLog(entry: JobLogEntry): Promise<void> {
  const logDir = getLogDir();
  if (!logDir) {
    return;
  }

  await mkdir(logDir, { recursive: true });

  const dateStr = entry.startedAt.slice(0, 10);
  const filePath = join(logDir, `${dateStr}.jsonl`);

  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

/** 保持日数を超えた古いログファイルを削除し、削除したファイル数を返す */
export async function cleanupOldLogs(retentionDays = 90): Promise<number> {
  const logDir = getLogDir();
  if (!logDir) {
    return 0;
  }

  let files: string[];
  try {
    files = await readdir(logDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
  const now = new Date();
  let deletedCount = 0;

  for (const file of files) {
    const match = DATE_JSONL_PATTERN.exec(file);
    if (!match) {
      continue;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    // 月の妥当性チェック (1-12) と日の妥当性チェック (1-31)
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      continue;
    }

    const fileDate = new Date(year, month - 1, day);
    const ageMs = now.getTime() - fileDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays > retentionDays) {
      await unlink(join(logDir, file));
      deletedCount++;
    }
  }

  return deletedCount;
}
