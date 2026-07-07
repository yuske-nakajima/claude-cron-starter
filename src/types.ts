export interface JobResult {
  status: "success" | "skipped";
  skipReason?: string;
  outputPath?: string;
}

export interface Job {
  name: string;
  schedule: string;
  // biome-ignore lint/suspicious/noConfusingVoidType: void との union で後方互換性を維持する
  run: () => Promise<JobResult | void>;
}
