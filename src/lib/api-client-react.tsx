import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Room {
  id: string;
  name: string;
  memberCount: number;
  hasKey?: boolean;
  createdAt?: string;
}

export interface CreateRoomData {
  name: string;
}

export interface CreatedRoom {
  id: string;
  name: string;
  key: string;
}

export function useListRooms() {
  return useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/chat/rooms");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCreateRoom(options?: {
  mutation?: {
    onSuccess?: (data: CreatedRoom) => void;
    onError?: (err: Error) => void;
  };
}) {
  const queryClient = useQueryClient();
  return useMutation<CreatedRoom, Error, { data: CreateRoomData }>({
    mutationFn: async ({ data }) => {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create room");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      options?.mutation?.onSuccess?.(data);
    },
    onError: options?.mutation?.onError,
  });
}
