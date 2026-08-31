import apiClient from "./api-client";

export interface PromptVersion {
  id: number;
  version: string;
  content: string;
  notes: string | null;
  author: string;
  is_active: boolean;
  created_at: string;
}

export interface PromptTestResponse {
  extracted_json: Record<string, any>;
  raw_response: string;
  success: boolean;
  error: string | null;
}

export const promptService = {
  getPrompts: async (): Promise<PromptVersion[]> => {
    const response = await apiClient.get<PromptVersion[]>("/prompts/");
    return response.data;
  },

  createPrompt: async (prompt: { version: string; content: string; notes?: string; author?: string; is_active?: boolean }): Promise<PromptVersion> => {
    const response = await apiClient.post<PromptVersion>("/prompts/", prompt);
    return response.data;
  },

  updatePrompt: async (id: number, prompt: { content?: string; notes?: string; is_active?: boolean }): Promise<PromptVersion> => {
    const response = await apiClient.put<PromptVersion>(`/prompts/${id}`, prompt);
    return response.data;
  },

  activatePrompt: async (id: number): Promise<PromptVersion> => {
    const response = await apiClient.post<PromptVersion>(`/prompts/${id}/activate`);
    return response.data;
  },

  deletePrompt: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/prompts/${id}`);
    return response.data;
  },

  testPrompt: async (promptContent: string, sampleOcrText?: string): Promise<PromptTestResponse> => {
    const response = await apiClient.post<PromptTestResponse>("/prompts/test", {
      prompt_content: promptContent,
      sample_ocr_text: sampleOcrText,
    });
    return response.data;
  },
};

export default promptService;
