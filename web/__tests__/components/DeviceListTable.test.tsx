import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeviceListTable from '@/components/devices/device-list-table';

describe('DeviceListTable', () => {
    const mockDevices = [
        {
            id: 'd1',
            name: 'Device 1',
            status: 'paired',
            token: 't1',
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            activePlaylist: { id: 'p1', name: 'Playlist 1' },
            playingPlaylistId: 'p1' // Synced
        },
        {
            id: 'd2',
            name: 'Device 2',
            status: 'offline',
            token: 't2',
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            activePlaylist: null,
            playingPlaylistId: null
        },
        {
            id: 'd3',
            name: 'Device 3',
            status: 'paired',
            token: 't3',
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            activePlaylist: { id: 'p2', name: 'Playlist 2' },
            playingPlaylistId: 'p1' // Mismatch -> Syncing
        }
    ];

    const mockPlaylists = [
        { id: 'p1', name: 'Playlist 1' },
        { id: 'p2', name: 'Playlist 2' }
    ];

    const mockHandlers = {
        onPlaylistChange: vi.fn(),
        onEdit: vi.fn(),
        onViewLogs: vi.fn(),
        onDelete: vi.fn()
    };

    it('renders device list correctly', () => {
        render(<DeviceListTable devices={mockDevices} playlists={mockPlaylists} {...mockHandlers} />);
        expect(screen.getByText('Device 1')).toBeInTheDocument();
        expect(screen.getByText('Device 2')).toBeInTheDocument();
    });

    it('shows loading state when updatingDeviceId matches', () => {
        // d1 is updating (Optimistic)
        render(
            <DeviceListTable
                devices={mockDevices}
                playlists={mockPlaylists}
                {...mockHandlers}
                updatingDeviceId="d1"
            />
        );

        // d1 should show "Syncing..."
        const syncingElements = screen.getAllByText('Syncing...');
        expect(syncingElements[0]).toBeInTheDocument();
    });

    it('shows loading state when activePlaylist differs from playingPlaylistId', () => {
        render(<DeviceListTable devices={mockDevices} playlists={mockPlaylists} {...mockHandlers} />);

        // d3 has mismatch (p2 vs p1), should show Syncing
        // d1 is synced, shows select
        // d2 has no playlist, shows select (default) or whatever default is

        // We expect at least one "Syncing..." for d3
        const syncingElements = screen.getAllByText('Syncing...');
        expect(syncingElements).toHaveLength(1);
    });
});
