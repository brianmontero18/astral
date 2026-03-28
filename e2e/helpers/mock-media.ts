import { Page } from "@playwright/test";

export async function mockMediaDevicesGranted(page: Page) {
  await page.addInitScript(() => {
    const mockStream = {
      getTracks: () => [{ stop: () => {}, kind: "audio", readyState: "live" }],
      getAudioTracks: () => [{ stop: () => {}, kind: "audio", readyState: "live" }],
    };
    navigator.mediaDevices.getUserMedia = async () => mockStream as unknown as MediaStream;

    if (navigator.permissions?.query) {
      navigator.permissions.query = async ({ name }: { name: string }) => {
        if (name === "microphone") return { state: "granted" } as PermissionStatus;
        return { state: "prompt" } as PermissionStatus;
      };
    }

    (window as unknown as Record<string, unknown>).MediaRecorder = class MockMediaRecorder {
      state = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        const blob = new Blob(["fake-audio"], { type: "audio/webm" });
        // Use queueMicrotask for async behavior matching real MediaRecorder
        queueMicrotask(() => {
          this.ondataavailable?.({ data: blob });
          queueMicrotask(() => {
            this.onstop?.();
          });
        });
      }

      static isTypeSupported() {
        return true;
      }
    };

    (window as unknown as Record<string, unknown>).AudioContext = class MockAudioContext {
      createAnalyser() {
        return {
          fftSize: 128,
          frequencyBinCount: 64,
          getByteFrequencyData: (arr: Uint8Array) => arr.fill(128),
          connect: () => {},
          disconnect: () => {},
        };
      }
      createMediaStreamSource() {
        return { connect: () => {}, disconnect: () => {} };
      }
      close() {}
    };
  });
}

export async function mockMediaDevicesDenied(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query = async ({ name }: { name: string }) => {
        if (name === "microphone") return { state: "denied" } as PermissionStatus;
        return { state: "prompt" } as PermissionStatus;
      };
    }
    (window as unknown as Record<string, unknown>).MediaRecorder = class {
      static isTypeSupported() { return true; }
    };
    (window as unknown as Record<string, unknown>).AudioContext = class {
      createAnalyser() {
        return { fftSize: 128, frequencyBinCount: 64, getByteFrequencyData: () => {}, connect: () => {}, disconnect: () => {} };
      }
      createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
      close() {}
    };
  });
}

export async function mockMediaDevicesNotFound(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("No device found", "NotFoundError");
    };
    (window as unknown as Record<string, unknown>).MediaRecorder = class {
      static isTypeSupported() { return true; }
    };
    (window as unknown as Record<string, unknown>).AudioContext = class {
      createAnalyser() {
        return { fftSize: 128, frequencyBinCount: 64, getByteFrequencyData: () => {}, connect: () => {}, disconnect: () => {} };
      }
      createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
      close() {}
    };
  });
}

export async function mockNoMediaDevices(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });
}
