/**
 * lib/request-registry.ts
 * 
 * Global AbortController registry used to manage and cancel outgoing requests,
 * especially useful for canceling requests on route changes.
 */

class RequestRegistry {
  private controllers = new Map<string, AbortController>();

  /**
   * Register a new request. If a request with the same ID already exists,
   * it is aborted before the new one is created.
   */
  register(id: string): AbortSignal {
    this.cancel(id);
    const controller = new AbortController();
    this.controllers.set(id, controller);
    return controller.signal;
  }

  /**
   * Cancel a specific request by ID.
   */
  cancel(id: string): void {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  /**
   * Cancel all pending requests in the registry.
   */
  cancelAll(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}

export const requestRegistry = new RequestRegistry();
