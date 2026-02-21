import { GoogleGenAI } from "@google/genai";

import {
  DIRECTION_KEYS,
  GEMINI_API_KEY,
  GEMINI_PILOT_PROMPT,
} from "./config";

type GeminiCommand = {
  direction: string;
  speed: number;
  time: number;
};

type GeminiControllerOptions = {
  getViewer: () => any;
  keyState: Set<string>;
  setSpeedMultiplier: (value: number) => void;
  resetSpeed: () => void;
};

export class GeminiController {
  private readonly getViewer: () => any;

  private readonly keyState: Set<string>;

  private readonly setSpeedMultiplier: (value: number) => void;

  private readonly resetSpeed: () => void;

  private active = false;

  private recorder: MediaRecorder | null = null;

  private cycleTimeout: number | null = null;

  private pending = false;

  private commandQueue: GeminiCommand[] = [];

  private commandTimer: number | null = null;

  constructor(options: GeminiControllerOptions) {
    this.getViewer = options.getViewer;
    this.keyState = options.keyState;
    this.setSpeedMultiplier = options.setSpeedMultiplier;
    this.resetSpeed = options.resetSpeed;
  }

  toggle(): void {
    this.active = !this.active;
    const overlay = document.getElementById("gemini-overlay");
    const textElement = document.getElementById("gemini-text");

    if (this.active) {
      if (overlay) {
        overlay.style.display = "block";
      }
      if (textElement) {
        textElement.textContent = "Recording 5s clip...";
      }
      this.startRecording();
      return;
    }

    this.stop();
  }

  stop(): void {
    if (this.cycleTimeout) {
      window.clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }

    if (this.commandTimer) {
      window.clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    this.commandQueue = [];

    Object.values(DIRECTION_KEYS).forEach((key) => this.keyState.delete(key));

    this.resetSpeed();

    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.pending = false;

    const overlay = document.getElementById("gemini-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  private startRecording(): void {
    const viewer = this.getViewer();
    if (!viewer) {
      return;
    }

    const stream = viewer.canvas.captureStream(10);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

    this.recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 500000,
    });

    const chunks: Blob[] = [];

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    this.recorder.onstop = async () => {
      if (!this.active) {
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      await this.sendToGemini(blob, mimeType);

      if (this.active && this.commandQueue.length === 0 && !this.commandTimer) {
        this.startRecording();
      }
    };

    this.recorder.start();

    this.cycleTimeout = window.setTimeout(() => {
      if (this.recorder && this.recorder.state === "recording") {
        this.recorder.stop();
      }
    }, 5000);
  }

  private parseCommands(text: string): GeminiCommand[] {
    const commands: GeminiCommand[] = [];
    const lines = text.trim().split("\n");

    lines.forEach((line) => {
      const match = line
        .trim()
        .match(/^(FORWARD|BACKWARD|LEFT|RIGHT|UP|DOWN)-(\d+)-(\d+)$/i);

      if (!match) {
        return;
      }

      commands.push({
        direction: match[1].toUpperCase(),
        speed: Math.max(1, Math.min(100, parseInt(match[2], 10))),
        time: Math.max(1, Math.min(5, parseInt(match[3], 10))),
      });
    });

    return commands;
  }

  private executeCommands(commands: GeminiCommand[]): void {
    this.commandQueue = commands.slice();
    this.executeNextCommand(document.getElementById("gemini-text"));
  }

  private executeNextCommand(textElement: HTMLElement | null): void {
    if (!this.active || this.commandQueue.length === 0) {
      this.commandTimer = null;
      if (this.active && !this.pending) {
        this.startRecording();
      }
      return;
    }

    const command = this.commandQueue.shift();
    if (!command) {
      this.executeNextCommand(textElement);
      return;
    }

    const key = DIRECTION_KEYS[command.direction];
    if (!key) {
      this.executeNextCommand(textElement);
      return;
    }

    this.setSpeedMultiplier(command.speed);

    if (textElement) {
      const remaining = [command, ...this.commandQueue]
        .map((item) => `${item.direction}-${item.speed}-${item.time}`)
        .join("\n");
      textElement.textContent = `Executing:\n${remaining}`;
    }

    this.keyState.add(key);

    this.commandTimer = window.setTimeout(() => {
      this.keyState.delete(key);
      this.commandTimer = window.setTimeout(
        () => this.executeNextCommand(textElement),
        100,
      );
    }, command.time * 1000);
  }

  private async sendToGemini(blob: Blob, mimeType: string): Promise<void> {
    const textElement = document.getElementById("gemini-text");
    this.pending = true;

    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      const base64 = btoa(binary);

      if (textElement) {
        textElement.textContent = "Thinking...";
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: base64, mimeType } },
              { text: GEMINI_PILOT_PROMPT },
            ],
          },
        ],
      });

      let fullText = "";
      for await (const chunk of response) {
        if (chunk.text) {
          fullText += chunk.text;
        }
      }

      const commands = this.parseCommands(fullText);
      if (commands.length > 0) {
        if (textElement) {
          textElement.textContent = commands
            .map((command) => `${command.direction}-${command.speed}-${command.time}`)
            .join("\n");
        }
        this.executeCommands(commands);
      } else {
        if (textElement) {
          textElement.textContent = "No valid commands. Retrying...";
        }
        if (this.active) {
          this.startRecording();
        }
      }
    } catch (error) {
      console.error("[Gemini] API error:", error);
      if (textElement) {
        textElement.textContent = `Error: ${(error as Error).message}`;
      }
      if (this.active) {
        this.startRecording();
      }
    }

    this.pending = false;
  }
}
