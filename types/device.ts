
export type Device = {
    id: string;
    name: string;
    token: string;
    status: string;
    lastSeenAt: string | null;
    activePlaylist: { id: string; name: string } | null;
    connectivityStatus?: string;
    createdAt: string;
};

export type Playlist = {
    id: string;
    name: string;
};
