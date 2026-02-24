import { after } from "next/server";

export function schedulePostResponseTask(label: string, task: () => Promise<void>): Promise<void> | void {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[${label}]`, error);
    }
  };

  // Keep route tests deterministic without requiring Next.js response lifecycle hooks.
  if (process.env.NODE_ENV === "test") {
    return run();
  }

  after(run);
}
