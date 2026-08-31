import apiClient from "./api-client";


export interface UserResponse {
  id: string | number;
  name: string;
  email: string;
  role: string;
  designation: string;
  status: string;
  organization_id?: string;
}

export const userService = {
  getUsers: async (): Promise<UserResponse[]> => {
    const response = await apiClient.get<UserResponse[]>("/users/");
    return response.data;
  },

  createUser: async (user: { name: string; email: string; role: string; designation: string; status?: string; password?: string }): Promise<UserResponse> => {
    const response = await apiClient.post<UserResponse>("/users/", user);
    return response.data;
  },

  updateUser: async (id: string | number, user: { name: string; email: string; role: string; designation: string; status?: string; password?: string }): Promise<UserResponse> => {
    const response = await apiClient.put<UserResponse>(`/users/${id}`, user);
    return response.data;
  },

  deleteUser: async (id: string | number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/users/${id}`);
    return response.data;
  },
};

export default userService;
