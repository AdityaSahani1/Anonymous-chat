import { create } from 'zustand';

interface AppState {
  username: string | null;
  activeRoom: string;
  isSidebarOpen: boolean;
  setUsername: (name: string | null) => void;
  setActiveRoom: (roomId: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  username: null,
  activeRoom: 'global',
  isSidebarOpen: false,
  setUsername: (name) => set({ username: name }),
  setActiveRoom: (roomId) => set({ activeRoom: roomId }),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
