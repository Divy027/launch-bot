export class LoopJob {
  active: boolean;
  gap: number;

  jobName: string;
  jobFunction: () => Promise<void>;

  constructor(
    jobName: string,
    jobFunction: () => Promise<void>,
    gapInMs: number
  ) {
    this.active = true;
    this.jobName = jobName;
    this.jobFunction = jobFunction;
    this.gap = gapInMs;
  }

  start() {
    console.log("\n");
    console.log(`%cStarting ${this.jobName} job...`, "color: blue");

    this.run().catch((error) => {
      console.error(`Error in ${this.jobName} job`, error);
    });
  }

  async run(): Promise<void> {
    while (this.active) {
      await new Promise((resolve) => setTimeout(resolve, this.gap / 2));
      if (!this.active) return;

      await this.jobFunction().catch((error) => {
        console.error(`Error in ${this.jobName} job`, error);
      });

      if (!this.active) return;
      await new Promise((resolve) => setTimeout(resolve, this.gap / 2));
      if (!this.active) return;
    }
  }

  stop() {
    this.active = false;
  }
}
