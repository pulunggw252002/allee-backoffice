import { sleep } from "@/lib/utils";
import { config } from "@/lib/config";

export async function delay<T>(value: T, ms?: number): Promise<T> {
  await sleep(ms ?? config.api.mockLatencyMs);
  return value;
}
