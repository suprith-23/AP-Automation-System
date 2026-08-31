"use client";
import React from "react";
import UserManagement from "../../../components/admin/UserManagement";
import { useAppStore } from "../../../store/useAppStore";
import { createUser, updateUser, deleteUser } from "../../../services/api";
import { useConfirmStore } from "../../../store/useConfirmStore";

export default function UsersRolesPage() {
  const { users, fetchAllData } = useAppStore();

  const handleCreateUser = async (payload: any) => {
    try {
      await createUser(payload);
      // Phase 8: Notification
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateUser = async (id: string | number, payload: any) => {
    try {
      await updateUser(id, payload);
      // Phase 8: Notification
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: string | number) => {
    const confirmed = await useConfirmStore.getState().confirm({
      title: "Delete User",
      message: "Are you sure you want to delete this user?",
      roleAccent: "red"
    });
    if (confirmed) {
      try {
        await deleteUser(id);
        // Phase 8: Notification
        await fetchAllData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <UserManagement
        users={users}
        onCreateUser={handleCreateUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
      />
    </div>
  );
}
