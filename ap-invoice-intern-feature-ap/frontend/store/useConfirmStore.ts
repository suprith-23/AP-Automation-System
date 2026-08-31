import { create } from "zustand";

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  roleAccent?: "green" | "purple" | "pink" | "teal" | "red" | "blue";
  resolveCallback: ((value: boolean) => void) | null;
  onConfirm: () => void;
  onCancel: () => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    roleAccent?: "green" | "purple" | "pink" | "teal" | "red" | "blue";
  }) => Promise<boolean>;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  roleAccent: "blue",
  resolveCallback: null,
  onConfirm: () => {
    const resolve = get().resolveCallback;
    set({ isOpen: false, resolveCallback: null });
    if (resolve) resolve(true);
  },
  onCancel: () => {
    const resolve = get().resolveCallback;
    set({ isOpen: false, resolveCallback: null });
    if (resolve) resolve(false);
  },
  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        roleAccent: options.roleAccent || "blue",
        resolveCallback: resolve,
      });
    });
  },
}));
