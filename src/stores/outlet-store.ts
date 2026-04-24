"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storageKey } from "@/lib/config";

interface OutletState {
  selectedOutletId: string | null;
  setOutletId: (id: string | null) => void;
}

export const useOutletStore = create<OutletState>()(
  persist(
    (set) => ({
      selectedOutletId: null,
      setOutletId: (id) => set({ selectedOutletId: id }),
    }),
    { name: storageKey("outlet") },
  ),
);
