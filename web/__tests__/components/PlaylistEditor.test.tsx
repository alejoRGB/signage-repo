import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import PlaylistEditor from '@/app/dashboard/playlists/playlist-editor';

// Mock dependencies
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/ui/toast-context", () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

describe('PlaylistEditor', () => {
    const mockLibrary = [
        { id: '1', name: 'Web Item', type: 'web', url: 'https://google.com', duration: 10, width: null, height: null, fps: null, createdAt: new Date() },
        { id: '2', name: 'Video Item', type: 'video', url: '/vid.mp4', duration: 15, width: 1920, height: 1080, fps: 30, createdAt: new Date() }
    ];

    const mockPlaylist = {
        id: 'p1',
        name: 'My Playlist',
        type: 'web' as const,
        items: []
    };

    it('renders generic icon for web items in library', () => {
        render(<PlaylistEditor playlist={mockPlaylist} library={mockLibrary} />);

        // Check for the web item name
        expect(screen.getByText('Web Item')).toBeInTheDocument();

        // Assert that the image tag with generic URL is NOT present
        // (if it was trying to render src="https://google.com", it would likely appear in DOM)
        const brokenImage = document.querySelector('img[src="https://google.com"]');
        expect(brokenImage).toBeNull();

        // Optionally, we could check for the existence of the icon wrapper div
        // but checking the absence of the broken image is the primary regression test here.
    });
});
