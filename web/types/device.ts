
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
    connectivityStatus?: string;
    schedule?: { id: string; name: string } | null;
    createdAt: string;
};

export type Playlist = {
    id: string;
    name: string;
};
