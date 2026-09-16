export type PollOptions = {
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  maxAttempts?: number;
};

export async function pollUntil<T>(
  fn: () => Promise<T>,
  isDone: (v: T) => boolean,
  opts: PollOptions = {},
  signal?: AbortSignal,
) {
  const initial = opts.initialDelay ?? 500;
  const maxDelay = opts.maxDelay ?? 5000;
  const factor = opts.factor ?? 2;
  const maxAttempts = opts.maxAttempts ?? 20;

  let attempt = 0;
  let delay = initial;
  while (true) {
    if (signal?.aborted) throw new DOMException('Polling stopped', 'AbortError');
    const value = await fn();
    if (isDone(value)) return value;
    attempt++;
    if (attempt >= maxAttempts) return value;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Polling stopped', 'AbortError'));
        },
        { once: true },
      );
    });
    delay = Math.min(delay * factor, maxDelay);
  }
}
