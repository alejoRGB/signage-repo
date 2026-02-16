
export type Device = {
    id: string;
    name: string;
    token: string;
    status: string;
    lastSeenAt: string | null;
    activePlaylist: { id: string; name: string } | null;
    defaultPlaylistId?: string | null;
    scheduleId?: string | null;
    playingPlaylistId?: string | null;
    playingPlaylist?: { id: string; name: string } | null;
    currentContentName?: string | null;
    previewImageUrl?: string | null;
    previewCapturedAt?: string | Date | null;
    connectivityStatus?: string;
    schedule?: { id: string; name: string } | null;
    createdAt: string;
};

export type Playlist = {
    id: string;
    name: string;
};
