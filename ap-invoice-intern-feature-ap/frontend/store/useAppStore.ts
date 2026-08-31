import { create } from 'zustand';
import { Invoice } from '../types/invoice';
import { PurchaseOrder } from '../types/purchase_order';
import { UserResponse } from '../services/user.service';
import authService from '../services/auth.service';
import { 
  getInvoices, 
  getPurchaseOrders, 
  getDashboardStats, 
  getAllAuditLogs, 
  getUsers, 
  aiProviderService, 
  enterpriseService 
} from '../services/api';

export type Role = "Admin" | "Reviewer" | "Approver" | "Auditor" | "Super Admin" | "Finance Manager";

interface AppState {
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  dashboardStats: any;
  enterpriseAnalytics: any;
  auditLogs: any[];
  users: UserResponse[];
  providers: any[];
  
  loading: boolean;
  fetchError: string | null;
  authChecked: boolean;
  activeFetches: Record<string, boolean>; // path-scoped fetch deduplication locks
  isInitialLoad: boolean;
  
  role: Role;
  
  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  setPurchaseOrders: (pos: PurchaseOrder[]) => void;
  setDashboardStats: (stats: any) => void;
  setEnterpriseAnalytics: (analytics: any) => void;
  setAuditLogs: (logs: any[]) => void;
  setUsers: (users: UserResponse[]) => void;
  setProviders: (providers: any[]) => void;
  
  setLoading: (loading: boolean) => void;
  setFetchError: (error: string | null) => void;
  setAuthChecked: (checked: boolean) => void;
  setRole: (role: Role) => void;
  
  fetchAllData: (showLoader?: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  invoices: [],
  purchaseOrders: [],
  dashboardStats: null,
  enterpriseAnalytics: null,
  auditLogs: [],
  users: [],
  providers: [],
  
  loading: true,
  fetchError: null,
  authChecked: false,
  activeFetches: {},
  isInitialLoad: true,
  
  role: "Admin",
  
  setInvoices: (invoices) => set({ invoices }),
  setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),
  setEnterpriseAnalytics: (enterpriseAnalytics) => set({ enterpriseAnalytics }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setUsers: (users) => set({ users }),
  setProviders: (providers) => set({ providers }),
  
  setLoading: (loading) => set({ loading }),
  setFetchError: (fetchError) => set({ fetchError }),
  setAuthChecked: (authChecked) => set({ authChecked }),
  setRole: (role) => set({ role }),

  fetchAllData: async (showLoader = false) => {
    if (!authService.isAuthenticated()) return;
    
    const path = typeof window !== "undefined" ? window.location.pathname : "/dashboard";
    const state = get();
    
    // Deduplication guard per path — prevents concurrent fetches on the same view
    if (state.activeFetches[path]) return;
    set({ activeFetches: { ...get().activeFetches, [path]: true } });

    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    
    // Determine if we actually need a full screen loading skeleton (only if target data is empty)
    let needsLoader = showLoader;
    if (needsLoader) {
      if (path.includes("/invoices") && state.invoices.length > 0) needsLoader = false;
      else if (path.includes("/purchase-orders") && state.purchaseOrders.length > 0) needsLoader = false;
      else if (path.includes("/users-roles") && state.users.length > 0) needsLoader = false;
      else if (path.includes("/audit-logs") && state.auditLogs.length > 0) needsLoader = false;
      else if (path.includes("/dashboard") && state.dashboardStats !== null) needsLoader = false;
    }

    if (needsLoader) set({ loading: true });

    try {
      const promises: Promise<any>[] = [];
      const keys: string[] = [];

      if (path.includes("/invoices") || path.includes("/approval-queue") || path.includes("/my-queue")) {
        promises.push(getInvoices().catch(() => []));
        keys.push("invoices");
        promises.push(getUsers().catch(() => []));
        keys.push("users");
        promises.push(getAllAuditLogs(100).catch(() => []));
        keys.push("auditLogs");
      } else if (path.includes("/purchase-orders")) {
        promises.push(getPurchaseOrders().catch(() => []));
        keys.push("purchaseOrders");
        promises.push(getAllAuditLogs(100).catch(() => []));
        keys.push("auditLogs");
      } else if (path.includes("/users-roles")) {
        promises.push(getUsers().catch(() => []));
        keys.push("users");
        promises.push(getAllAuditLogs(100).catch(() => []));
        keys.push("auditLogs");
      } else if (path.includes("/analytics")) {
        promises.push(getInvoices().catch(() => []));
        keys.push("invoices");
        promises.push(getPurchaseOrders().catch(() => []));
        keys.push("purchaseOrders");
        promises.push(enterpriseService.getAnalyticsDashboard().catch(() => null));
        keys.push("enterpriseAnalytics");
        promises.push(getAllAuditLogs(100).catch(() => []));
        keys.push("auditLogs");
      } else {
        // Default / Dashboard
        promises.push(getInvoices().catch(() => []));
        keys.push("invoices");
        promises.push(getPurchaseOrders().catch(() => []));
        keys.push("purchaseOrders");
        promises.push(getDashboardStats().catch(() => null));
        keys.push("dashboardStats");
        promises.push(getAllAuditLogs(100).catch(() => []));
        keys.push("auditLogs");
        promises.push(getUsers().catch(() => []));
        keys.push("users");
        promises.push(aiProviderService.getProviders().catch(() => []));
        keys.push("providers");
        promises.push(enterpriseService.getAnalyticsDashboard().catch(() => null));
        keys.push("enterpriseAnalytics");
      }

      const results = await Promise.all(promises);
      const updates: any = {};
      keys.forEach((key, idx) => {
        updates[key] = results[idx];
      });

      set({
        ...updates,
        fetchError: null
      });
    } catch (err: any) {
      console.error("Critical dashboard load failed", err);
      set({ fetchError: err.message || "Failed to load data" });
    } finally {
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        const ms = Math.round((t1 as number) - (t0 as number));
        console.log(`[route-data] ${path} ${ms}ms`);
      }
      const fetches = { ...get().activeFetches };
      delete fetches[path];
      set({ activeFetches: fetches, loading: false, isInitialLoad: false });
    }
  },
}));
