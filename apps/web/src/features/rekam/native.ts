import { registerPlugin } from "@capacitor/core";

export interface RumaRecorderPlugin {
  mulai(options: { judul?: string }): Promise<void>;
  berhenti(): Promise<void>;
}

export const RumaRecorder = registerPlugin<RumaRecorderPlugin>("RumaRecorder");
