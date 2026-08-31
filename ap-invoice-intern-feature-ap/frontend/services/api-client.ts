import axios from "axios";
import axiosRetry from "axios-retry";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 120 seconds timeout
  withCredentials: true,
  xsrfCookieName: "csrf_token",
  xsrfHeaderName: "X-CSRF-Token",
  headers: {
    "Content-Type": "application/json",
  },
});

// Configure automatic retries with exponential backoff for failed requests
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 503;
  }
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      // Offline detection
      if (!navigator.onLine) {
        return Promise.reject(new Error("No internet connection. Please check your network."));
      }
      
      // Manually extract and attach CSRF token to support cross-port/cross-origin requests
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="));
      if (csrfCookie) {
        const csrfToken = csrfCookie.split("=")[1];
        if (csrfToken) {
          config.headers["X-CSRF-Token"] = csrfToken;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Hard loop guard: if the request has already been retried once, do not retry again.
    if (error.response?.status === 401 && originalRequest?._retry) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("user");
        localStorage.removeItem("user");
        window.location.href = "/session-expired";
      }
      return Promise.reject(error);
    }

    // Avoid infinite loop if refreshing fails or it's a login route
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/logout") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Set _retry = true on the queued request before retrying it
            originalRequest._retry = true;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { 
            withCredentials: true,
            xsrfCookieName: "csrf_token",
            xsrfHeaderName: "X-CSRF-Token"
          }
        );
        processQueue(null, "success");
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("user");
          localStorage.removeItem("user");
          window.location.href = "/session-expired";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
