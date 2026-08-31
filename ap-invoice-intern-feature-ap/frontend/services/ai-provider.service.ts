import apiClient from "./api-client";

export interface AIProviderConfig {
  id: number;
  name: string;
  api_url: string;
  api_key?: string;
  model?: string;
  response_format: string; // openai | gemini | colab
  priority: number;
  enabled: boolean;
}

export const aiProviderService = {
  async getProviders(): Promise<AIProviderConfig[]> {
    const res = await apiClient.get<AIProviderConfig[]>("/ai-providers");
    return res.data;
  },

  async addProvider(provider: Omit<AIProviderConfig, "id">): Promise<AIProviderConfig> {
    const res = await apiClient.post<AIProviderConfig>("/ai-providers", provider);
    return res.data;
  },

  async updateProvider(id: number, provider: Partial<AIProviderConfig>): Promise<AIProviderConfig> {
    const res = await apiClient.put<AIProviderConfig>(`/ai-providers/${id}`, provider);
    return res.data;
  },

  async deleteProvider(id: number): Promise<void> {
    await apiClient.delete(`/ai-providers/${id}`);
  },

  async seedProviders(): Promise<void> {
    await apiClient.post("/ai-providers/seed");
  },

  async testProvider(id: number): Promise<{ success: boolean; response?: string; error?: string }> {
    const res = await apiClient.post<{ success: boolean; response?: string; error?: string }>(
      `/ai-providers/${id}/test`
    );
    return res.data;
  },
};
