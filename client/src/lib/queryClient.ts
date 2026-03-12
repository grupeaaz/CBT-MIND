import { QueryClient, QueryFunction } from "@tanstack/react-query";

export function getDeviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

// Retrieve the server-issued device token, registering with server if needed
async function getDeviceToken(): Promise<string> {
  const stored = localStorage.getItem("deviceToken");
  if (stored) return stored;

  const deviceId = getDeviceId();
  const res = await fetch("/api/device/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });

  if (!res.ok) {
    // Fall back to raw deviceId header if registration fails (e.g. server not updated yet)
    return "";
  }

  const data = await res.json();
  localStorage.setItem("deviceToken", data.token);
  return data.token;
}

// Build auth headers — prefer server-issued token, fall back to raw deviceId
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("deviceToken");
  if (token) {
    return { "X-Device-Token": token };
  }
  // Fallback for first request before token is registered
  return { "X-Device-Id": getDeviceId() };
}

// Trigger device registration eagerly (non-blocking) on app start
getDeviceToken().catch(() => {});

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
