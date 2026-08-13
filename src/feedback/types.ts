export interface SensorOutput {
  status: "pass" | "fail" | "error";
  details: string;
  failureCount: number;
}

export interface Feedback {
  hasFailures: boolean;
  message: string;
  failureCount: number;
}

export interface Sensor {
  name: string;
  run(): Promise<SensorOutput>;
  parse(output: SensorOutput): Feedback;
}