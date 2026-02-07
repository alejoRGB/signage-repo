import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeviceListTable from '@/components/devices/device-list-table';

describe('DeviceListTable', () => {
    const mockDevices = [
        {
            id: 'd1',
            name: 'Device 1',
            status: 'paired',
            lastSeenAt: new Date().toISOString(),
            activePlaylist: { id: 'p1', name: 'Playlist 1' }
        },
        {
            id: 'd2',
            name: 'Device 2',
            status: 'offline',
            lastSeenAt: new Date().toISOString(),
            activePlaylist: null
        }
    ];

    const mockPlaylists = [
        { id: 'p1', name: 'Playlist 1', type: 'media', items: [] },
        { id: 'p2', name: 'Playlist 2', type: 'media', items: [] }
    ];

    const mockHandlers = {
        onPlaylistChange: vi.fn(),
        onPushPlaylist: vi.fn(),
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
        // d1 is updating
        render(
            <DeviceListTable
                devices={mockDevices}
                playlists={mockPlaylists}
                {...mockHandlers}
                updatingDeviceId="d1"
            />
        );

        // d1 should show "Syncing..."
        expect(screen.getByText('Syncing...')).toBeInTheDocument();

        // d2 should still show the select, but it might be disabled if we disabled all
        // In our implementation we disabled all selects when one is updating
        // Let's check if the select for d2 exists
        const selects = screen.getAllByRole('combobox');
        expect(selects).toHaveLength(1); // Only d2 has a select, d1 has Syncing text
        expect(selects[0]).toBeDisabled();
    });
});
