/**
 * @jest-environment node
 */
import { GET } from '@/app/api/health/route';

describe('Health Check API', () => {
    it('returns 200 and status ok', async () => {
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ status: 'ok' });
    });
});
