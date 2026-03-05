import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiFetch, clearCsrfTokenCache } from "../lib/api";
import { trackPromise } from "../lib/promiseTracker";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role?: "user" | "admin";
  lat?: number | null;
  lon?: number | null;
  lastLoginIp?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone: string,
  ) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  authInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface Coordinates {
  lat: number | null;
  lon: number | null;
}

const emptyCoordinates: Coordinates = { lat: null, lon: null };

const getFallbackCoordinates = (
  lat?: number | null,
  lon?: number | null,
): Coordinates => ({
  lat: lat ?? null,
  lon: lon ?? null,
});

const isGeolocationPermissionDenied = async (): Promise<boolean> => {
  if (
    !("permissions" in navigator) ||
    typeof navigator.permissions.query !== "function"
  ) {
    return false;
  }

  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state === "denied";
  } catch {
    return false;
  }
};

const resolvePreferredCoordinates = async (
  fallback: Coordinates,
): Promise<Coordinates> =>
  trackPromise(
    (async () => {
      if (typeof window === "undefined") {
        return fallback;
      }

      if (!("geolocation" in navigator)) {
        return fallback;
      }

      if (await isGeolocationPermissionDenied()) {
        return fallback;
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              resolve(fallback);
              return;
            }

            // Do not silently fall back to IP-based location for transient browser GPS failures.
            resolve(emptyCoordinates);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          },
        );
      });
    })(),
  );

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);

  const fetchCurrentUser = async (): Promise<User> => {
    const profile = await apiFetch<{
      id: string;
      name: string;
      email: string;
      phone_number?: number;
      role?: "user" | "admin";
      lat?: number | null;
      lon?: number | null;
      lastLoginIp?: string | null;
    }>("/auth/me");
    const fallbackCoords = getFallbackCoordinates(profile.lat, profile.lon);
    const coords = await resolvePreferredCoordinates(fallbackCoords);

    return {
      id: profile.id,
      name: `${profile.name}`.trim(),
      email: profile.email,
      phone: profile.phone_number ? String(profile.phone_number) : "",
      role: profile.role ?? "user",
      lat: coords.lat,
      lon: coords.lon,
      lastLoginIp: profile.lastLoginIp ?? null,
    };
  };

  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          setUser(parsedUser);
        } catch {
          localStorage.removeItem("user");
        }
      }

      try {
        await apiFetch("/auth/refresh", { method: "POST" });
        const freshUser = await fetchCurrentUser();
        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch {
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("pendingUser");
      } finally {
        setAuthInitializing(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const normalizedEmail = String(email).toLowerCase().trim();
    await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const authenticatedUser = await fetchCurrentUser();
    setUser(authenticatedUser);
    localStorage.setItem("user", JSON.stringify(authenticatedUser));
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phone: string,
  ) => {
    // const [firstName, ...lastParts] = name.trim().split(' ');
    // const lastName = lastParts.join(' ') || firstName;

    const payload = {
      name,
      email,
      password,
      phone_number: phone.replace(/\D/g, ""),
    };

    await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const pendingUser: User = {
      id: "current",
      name,
      email,
      phone,
      role: "user",
    };

    localStorage.setItem("pendingUser", JSON.stringify(pendingUser));
  };

  const verifyEmail = async (code: string) => {
    await apiFetch("/auth/confirm", {
      method: "POST",
      body: JSON.stringify({ otpToken: code }),
    });

    const verifiedUser = await fetchCurrentUser();
    localStorage.removeItem("pendingUser");
    setUser(verifiedUser);
    localStorage.setItem("user", JSON.stringify(verifiedUser));
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Local cleanup still proceeds if backend session is already invalid.
    } finally {
      clearCsrfTokenCache();
    }

    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("pendingUser");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        verifyEmail,
        logout,
        isAuthenticated: !!user,
        authInitializing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
