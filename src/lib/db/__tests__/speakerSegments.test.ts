/** @jest-environment node */

const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../prisma', () => ({
    __esModule: true,
    default: { speakerSegment: { findMany: (...args: unknown[]) => mockFindMany(...args), count: (...args: unknown[]) => mockCount(...args) } },
}));
jest.mock('../../auth', () => ({ withUserAuthorizedToEdit: jest.fn() }));

import { PUBLIC_RECORDING_WHERE } from '@/lib/meetingLifecycleRules';
import { getLatestSegmentsForParty, getLatestSegmentsForSpeaker } from '../speakerSegments';

beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
});

/**
 * The segment lists of a person and a party page read the transcript. A
 * reader gets the released meetings with a public recording: a meeting
 * closed to the public withholds its transcript, as the meeting page does.
 */
describe.each([
    ['getLatestSegmentsForSpeaker', (unreleased: boolean) => getLatestSegmentsForSpeaker('p1', 1, 5, null, unreleased)],
    ['getLatestSegmentsForParty', (unreleased: boolean) => getLatestSegmentsForParty('party1', 1, 5, unreleased)],
])('%s', (_name, read) => {
    it('gives a reader the released meetings with a public recording', async () => {
        await read(false);
        expect(mockFindMany.mock.calls[0][0].where.meeting).toMatchObject({ released: true, ...PUBLIC_RECORDING_WHERE });
    });

    it('gives an editor every meeting', async () => {
        await read(true);
        const meeting = mockFindMany.mock.calls[0][0].where.meeting;
        expect(meeting.released).toBeUndefined();
        expect(meeting.closedToPublic).toBeUndefined();
    });
});
