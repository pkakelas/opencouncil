import { PUBLIC_CITY_WHERE } from '@/lib/cityStatus';
jest.mock('@/lib/db/prisma', () => ({ __esModule: true, default: { councilMeeting: { findFirst: jest.fn() }, subject: { findFirst: jest.fn() } } }));
import prisma from '@/lib/db/prisma';
import { getPublicMeeting, getPublicSubject, transcriptIsPublic, publicMeetingSelect, publicSubjectSelect, type PublicMeeting } from '../publicContent';

describe('public sharing boundary', () => {
    it('scopes meeting access by city, release and request realm without editor overrides', async () => {
        await getPublicMeeting('city', 'meeting', 'france');
        expect(prisma.councilMeeting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { cityId: 'city', id: 'meeting', released: true, city: { ...PUBLIC_CITY_WHERE, realm: 'france' } } }));
    });
    it('requires the exact subject tuple and does not fetch private or transcript relations', async () => {
        await getPublicSubject('city', 'meeting', 'subject', 'greece');
        expect(prisma.subject.findFirst).toHaveBeenCalledWith({ where: { id: 'subject', cityId: 'city', councilMeetingId: 'meeting', councilMeeting: { released: true, city: { ...PUBLIC_CITY_WHERE, realm: 'greece' } } }, select: publicSubjectSelect });
        expect(JSON.stringify(publicSubjectSelect)).not.toMatch(/votes|attendance|speakerSegments|highlights|geometry/);
    });
    it('honors the existing human-review visibility contract', () => {
        const meeting = { format: 'inPerson', closedToPublic: false, noRecording: false, administrativeBody: { showUnreviewedTranscript: false }, taskStatuses: [] } as unknown as PublicMeeting;
        expect(transcriptIsPublic(meeting)).toBe(false);
        expect(transcriptIsPublic({ ...meeting, taskStatuses: [{ id: 'review' }] })).toBe(true);
        expect(transcriptIsPublic({ ...meeting, administrativeBody: null })).toBe(true);
    });
    // The meeting page withholds the transcript of such a meeting from readers;
    // a shared excerpt or contribution must not hand it out through the side door.
    it('withholds the transcript of a meeting with no public recording, reviewed or not', () => {
        const reviewed = { format: 'inPerson', closedToPublic: false, noRecording: false, administrativeBody: null, taskStatuses: [{ id: 'review' }] } as unknown as PublicMeeting;
        expect(transcriptIsPublic({ ...reviewed, closedToPublic: true })).toBe(false);
        expect(transcriptIsPublic({ ...reviewed, noRecording: true })).toBe(false);
        expect(transcriptIsPublic({ ...reviewed, format: 'byCirculation' })).toBe(false);
        expect(publicMeetingSelect).toMatchObject({ format: true, closedToPublic: true, noRecording: true });
    });
});
