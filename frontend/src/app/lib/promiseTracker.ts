type PendingPromiseListener = () => void;

const listeners = new Set<PendingPromiseListener>();
let pendingPromiseCount = 0;

const FETCH_TRACKED_MARK = Symbol.for("flowbot.fetch.tracked");

type MarkedFetch = typeof globalThis.fetch & {
  [FETCH_TRACKED_MARK]?: boolean;
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const updatePendingPromiseCount = (nextValue: number) => {
  const normalizedValue = Math.max(0, nextValue);
  if (normalizedValue === pendingPromiseCount) {
    return;
  }

  pendingPromiseCount = normalizedValue;
  notifyListeners();
};

const adjustPendingPromiseCount = (delta: number) => {
  updatePendingPromiseCount(pendingPromiseCount + delta);
};

export const getPendingPromiseCount = () => pendingPromiseCount;

export const subscribePendingPromiseCount = (listener: PendingPromiseListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const trackPromise = <T,>(promise: Promise<T>): Promise<T> => {
  adjustPendingPromiseCount(1);
  return promise.finally(() => {
    adjustPendingPromiseCount(-1);
  });
};

export const installGlobalFetchTracking = () => {
  if (typeof globalThis.fetch !== "function") {
    return;
  }

  const currentFetch = globalThis.fetch as MarkedFetch;
  if (currentFetch[FETCH_TRACKED_MARK]) {
    return;
  }

  const originalFetch = currentFetch.bind(globalThis);
  const trackedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    trackPromise(originalFetch(input, init))) as MarkedFetch;

  trackedFetch[FETCH_TRACKED_MARK] = true;
  globalThis.fetch = trackedFetch;
};
