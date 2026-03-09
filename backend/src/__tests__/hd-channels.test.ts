/**
 * HD Channels — Data integrity tests
 *
 * Verifies the 36 HD channels are correctly defined with proper
 * gate references and circuit assignments.
 */

import { describe, it, expect } from "vitest";
import { HD_CHANNELS } from "../hd-channels.js";
import { GATE_TO_CENTER } from "../hd-gates.js";

describe("HD_CHANNELS", () => {
  const entries = Object.entries(HD_CHANNELS);

  it("defines exactly 36 channels", () => {
    expect(entries.length).toBe(36);
  });

  it("every channel key is a valid gate pair (lower-higher)", () => {
    for (const [key] of entries) {
      const [g1, g2] = key.split("-").map(Number);
      expect(g1, `Channel ${key}: first gate invalid`).toBeGreaterThanOrEqual(1);
      expect(g1).toBeLessThanOrEqual(64);
      expect(g2, `Channel ${key}: second gate invalid`).toBeGreaterThanOrEqual(1);
      expect(g2).toBeLessThanOrEqual(64);
      expect(g1, `Channel ${key}: gates not in ascending order`).toBeLessThan(g2);
    }
  });

  it("every channel references gates that exist in GATE_TO_CENTER", () => {
    for (const [key] of entries) {
      const [g1, g2] = key.split("-").map(Number);
      expect(GATE_TO_CENTER[g1], `Gate ${g1} from channel ${key} not in GATE_TO_CENTER`).toBeDefined();
      expect(GATE_TO_CENTER[g2], `Gate ${g2} from channel ${key} not in GATE_TO_CENTER`).toBeDefined();
    }
  });

  it("every channel connects two DIFFERENT centers", () => {
    for (const [key] of entries) {
      const [g1, g2] = key.split("-").map(Number);
      const center1 = GATE_TO_CENTER[g1];
      const center2 = GATE_TO_CENTER[g2];
      expect(center1, `Channel ${key}: gates should connect different centers`).not.toBe(center2);
    }
  });

  it("every channel has a non-empty name", () => {
    for (const [key, name] of entries) {
      expect(name, `Channel ${key} has empty name`).toBeTruthy();
      expect(name.length).toBeGreaterThan(5);
    }
  });

  it("has no duplicate channel names", () => {
    const names = entries.map(([, name]) => name);
    expect(new Set(names).size).toBe(names.length);
  });
});
