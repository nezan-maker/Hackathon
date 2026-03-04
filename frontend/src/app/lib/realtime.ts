import { API_URL } from "./api";
import { loadExternalScript } from "./loadExternalScript";

const SOCKET_IO_CDN = "https://cdn.socket.io/4.8.3/socket.io.min.js";

declare global {
  interface Window {
    io?: (
      uri: string,
      opts?: Record<string, unknown>,
    ) => {
      on: (event: string, handler: (...args: any[]) => void) => void;
      off: (event: string, handler?: (...args: any[]) => void) => void;
      disconnect: () => void;
      connected?: boolean;
    };
  }
}

export interface RealtimeSocket {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  disconnect: () => void;
  connected?: boolean;
}

let socketPromise: Promise<RealtimeSocket> | null = null;

export const getRealtimeSocket = async (): Promise<RealtimeSocket> => {
  if (!socketPromise) {
    socketPromise = (async () => {
      await loadExternalScript(SOCKET_IO_CDN);
      if (!window.io) {
        throw new Error("Socket.IO client failed to initialize");
      }

      return window.io(API_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    })();
  }

  return socketPromise;
};
