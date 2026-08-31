import apiClient from "./api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KeyStatus = "active" | "rate_limited" | "expired";

export type ProviderName = "groq" | "gemini" | "nvidia" | "hf" | "colab";

export interface OrgAPIKey {
  id: number;
  org_id?: string | null;
  provider_name: ProviderName | string;
  key_name: string;
  masked_key: string;
  status: KeyStatus;
  priority_order: number;
  enabled: boolean;
  last_used_at?: string | null;
  last_error?: string | null;
  cooldown_until?: string | null;
}

export interface OrgAPIKeyCreate {
  provider_name: string;
  key_name: string;
  api_key: string;
  priority_order?: number;
  enabled?: boolean;
  org_id?: string | null;
}

export interface OrgAPIKeyUpdate {
  key_name?: string;
  api_key?: string;
  priority_order?: number;
  enabled?: boolean;
  status?: KeyStatus;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const orgKeyService = {
  async listKeys(): Promise<OrgAPIKey[]> {
    const res = await apiClient.get<OrgAPIKey[]>("/org-keys");
    return res.data;
  },

  async addKey(payload: OrgAPIKeyCreate): Promise<OrgAPIKey> {
    const res = await apiClient.post<OrgAPIKey>("/org-keys", payload);
    return res.data;
  },

  async updateKey(id: number, payload: OrgAPIKeyUpdate): Promise<OrgAPIKey> {
    const res = await apiClient.put<OrgAPIKey>(`/org-keys/${id}`, payload);
    return res.data;
  },

  async deleteKey(id: number): Promise<void> {
    await apiClient.delete(`/org-keys/${id}`);
  },

  async testKey(id: number): Promise<{ status: string; latency_ms?: number; error?: string }> {
    const res = await apiClient.post<{ status: string; latency_ms?: number; error?: string }>(`/org-keys/${id}/test`);
    return res.data;
  },
};
