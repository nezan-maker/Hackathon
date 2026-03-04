import { useSyncExternalStore } from "react";
import {
  getPendingPromiseCount,
  subscribePendingPromiseCount,
} from "../lib/promiseTracker";

export const usePendingPromiseCount = () =>
  useSyncExternalStore(
    subscribePendingPromiseCount,
    getPendingPromiseCount,
    getPendingPromiseCount,
  );
