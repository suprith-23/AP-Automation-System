import apiClient from "./api-client";
import Cookies from "js-cookie";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Reviewer" | "Approver" | "Auditor" | "Super Admin";
  designation: string;
  status: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  must_change_password?: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export const authService = {
  login: async (credentials: { email: string; password: string }, rememberMe?: boolean): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/login", credentials);
    const data = response.data;
    if (data.user) {
      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify(data.user));
        sessionStorage.removeItem("user");
        Cookies.set("role", data.user.role, { expires: 7 });
      } else {
        sessionStorage.setItem("user", JSON.stringify(data.user));
        localStorage.removeItem("user");
        Cookies.set("role", data.user.role);
      }
    }
    return data;
  },

  register: async (details: any): Promise<User> => {
    const response = await apiClient.post<User>("/auth/register", details);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    const isLocal = !!localStorage.getItem("user");
    if (isLocal) {
      localStorage.setItem("user", JSON.stringify(response.data));
    } else {
      sessionStorage.setItem("user", JSON.stringify(response.data));
    }
    Cookies.set("role", response.data.role, isLocal ? { expires: 7 } : undefined);
    return response.data;
  },

  refreshToken: async (): Promise<string> => {
    const response = await apiClient.post<{ access_token: string; token_type: string }>(
      "/auth/refresh"
    );
    return response.data.access_token;
  },

  logout: async (): Promise<void> => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("user");
      localStorage.removeItem("user");
      Cookies.remove("role");
      document.cookie = "role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    
    try {
      await apiClient.post("/auth/logout", {});
    } catch (err) {
      console.warn("Backend logout notification failed:", err);
    }
  },

  clearLocalAuth: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("user");
      localStorage.removeItem("user");
      Cookies.remove("role");
      document.cookie = "role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  },

  isAuthenticated: (): boolean => {
    if (typeof window === "undefined") return false;
    const userStr = sessionStorage.getItem("user") || localStorage.getItem("user");
    const role = Cookies.get("role");
    return !!userStr && !!role;
  },

  getStoredUser: (): User | null => {
    if (typeof window === "undefined") return null;
    const userStr = sessionStorage.getItem("user") || localStorage.getItem("user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
};

export default authService;
