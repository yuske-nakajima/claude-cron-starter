import type { Job } from "../types";
import * as hello from "./hello";

export const jobs: Job[] = [
  { name: "hello", schedule: hello.schedule, run: hello.run },
];
