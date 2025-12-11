/**
 * Minimal ChatAgent placeholder
 *
 * This file provides a minimal named export `ChatAgent` to satisfy imports
 * from other modules. It intentionally does not implement any Durable Object
 * behavior — it acts as a stub to avoid module-not-found / loading errors.
 *
 * If you later reintroduce the full ChatAgent implementation, replace this
 * file with the production implementation.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export class ChatAgent {
  /**
   * Minimal constructor placeholder.
   * Durable Object runtime will not instantiate this stub for real usage.
   */
  constructor(..._args: unknown[]) {
    // Intentionally empty.
  }
  /**
   * Optional lifecycle placeholder method.
   * Implement actual behavior in the full ChatAgent replacement.
   */
  async onStart(): Promise<void> {
    // No-op
  }
}