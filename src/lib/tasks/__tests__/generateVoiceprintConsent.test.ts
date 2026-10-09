/** @jest-environment node */

const mockPersonFindUnique = jest.fn();
const mockPersonFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
    __esModule: true,
    default: {
        person: {
            findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
            findMany: (...args: unknown[]) => mockPersonFindMany(...args),
        },
    },
}));
jest.mock('@/lib/db/meetings', () => ({ getCouncilMeeting: jest.fn() }));
jest.mock('../../auth', () => ({ withUserAuthorizedToEdit: jest.fn().mockResolvedValue(true) }));
jest.mock('../tasks', () => ({ startTask: jest.fn() }));
jest.mock('@/lib/db/voiceprintsCreate', () => ({ createVoicePrintDirect: jest.fn() }));

import { findEligiblePeopleForVoiceprintGeneration, requestGenerateVoiceprint } from '../generateVoiceprint';

const youthOnly = { roles: [{ administrativeBody: { type: 'youthCouncil' } }] };
const councillor = { roles: [{ administrativeBody: { type: 'council' } }] };
/** A segment long enough for a voiceprint, from a tag the admin set. */
const longTag = {
    personSetBy: 'admin', createdAt: new Date('2026-01-01'),
    speakerSegments: [{ id: 's1', startTimestamp: 0, endTimestamp: 60, meeting: { taskStatuses: [] } }],
};

beforeEach(() => jest.clearAllMocks());

describe('requestGenerateVoiceprint and the own consent of a secondary body member (#829)', () => {
    it('refuses a member of a youth council alone who gave no consent from their account', async () => {
        mockPersonFindUnique.mockResolvedValueOnce({ ...youthOnly, voicePrintConsents: [] });
        await expect(requestGenerateVoiceprint('p1')).rejects.toThrow('own account');
        expect(mockPersonFindUnique).toHaveBeenCalledTimes(1);
    });

    it('goes on for such a member with a consent from their account, and for a councillor without one', async () => {
        // The second lookup is the segment search; no tags means the next refusal, which proves the first gate passed.
        mockPersonFindUnique
            .mockResolvedValueOnce({ ...youthOnly, voicePrintConsents: [{ id: 'c1' }] })
            .mockResolvedValueOnce({ speakerTags: [] });
        await expect(requestGenerateVoiceprint('p1')).rejects.toThrow('No speaker segments');

        mockPersonFindUnique
            .mockResolvedValueOnce({ ...councillor, voicePrintConsents: [] })
            .mockResolvedValueOnce({ speakerTags: [] });
        await expect(requestGenerateVoiceprint('p2')).rejects.toThrow('No speaker segments');
    });

    it('leaves such a member out of the bulk list until they consent', async () => {
        mockPersonFindMany.mockResolvedValue([
            { id: 'p1', name: 'Μαρία', ...youthOnly, voicePrintConsents: [], speakerTags: [longTag] },
            { id: 'p2', name: 'Γιώργος', ...youthOnly, voicePrintConsents: [{ id: 'c1' }], speakerTags: [longTag] },
            { id: 'p3', name: 'Νίκος', ...councillor, voicePrintConsents: [], speakerTags: [longTag] },
        ]);

        const { eligiblePeople } = await findEligiblePeopleForVoiceprintGeneration('chania');

        expect(eligiblePeople.map(person => person.id)).toEqual(['p2', 'p3']);
    });
});
