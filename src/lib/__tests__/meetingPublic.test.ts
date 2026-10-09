import { effectivePlace, hideLinks, publicRow, toPublicApiMeeting } from '../meetingPublic';

const row = {
    id: 'b',
    cityId: 'c1',
    name: null,
    name_en: null,
    kind: 'regular' as const,
    dateTime: new Date('2026-03-19T16:00:00Z'),
    released: true,
    sessionNumber: 3,
    scheduleStatus: 'scheduled' as const,
    scheduleStatusReason: null,
    format: 'inPerson' as const,
    closedToPublic: false,
    noRecording: false,
    place: null,
    postponedFromId: 'mar12_2026',
    continuationOfId: 'mar5_2026',
    hiddenByPostponement: false,
    administrativeBody: { name: 'Δημοτικό Συμβούλιο', name_en: 'Municipal Council', place: 'Δημαρχείο Χανίων' },
};

describe('public meeting projections', () => {
    it('gives the API the labels, the titles, the place and the original date, and never the id of a linked meeting', () => {
        const payload = toPublicApiMeeting(row, { timezone: 'Europe/Athens', postponedFromDate: new Date('2026-03-12T16:00:00Z') });
        expect(payload).toMatchObject({
            name: 'Δημοτικό Συμβούλιο · 3η Τακτική · 19/03/2026',
            name_en: 'Municipal Council · 3rd Regular · 19/03/2026',
            title: '3η Τακτική',
            title_en: '3rd Regular',
            place: 'Δημαρχείο Χανίων',
            postponedFromDate: '2026-03-12T16:00:00.000Z',
        });
        expect(payload).not.toHaveProperty('continuationOfId');
        expect(payload).not.toHaveProperty('hiddenByPostponement');
        expect(JSON.stringify(payload)).not.toContain('mar5_2026');
        expect(payload).not.toHaveProperty('postponedFromId');
        expect(JSON.stringify(payload)).not.toContain('mar12_2026');
    });

    it('keeps the shape of a page row and clears the link', () => {
        expect(hideLinks(row)).toEqual({ ...row, postponedFromId: null, continuationOfId: null });
    });

    it('prefers the place of the meeting over the hall of its body', () => {
        expect(effectivePlace({ ...row, place: 'Πολιτιστικό Κέντρο' })).toBe('Πολιτιστικό Κέντρο');
        expect(effectivePlace({ ...row, place: null })).toBe(row.administrativeBody.place);
        expect(effectivePlace({ format: 'inPerson', place: null, administrativeBody: null })).toBeNull();
    });

    it('gives a meeting no place when its format has none', () => {
        expect(effectivePlace({ ...row, format: 'teleconference' })).toBeNull();
        expect(effectivePlace({ ...row, format: 'mixed' })).toBe(row.administrativeBody.place);
    });

    it('gives a public list no links, and no media of a meeting with no public recording', () => {
        const media = { youtubeUrl: 'https://youtu.be/x', videoUrl: 'https://cdn/v.mp4', audioUrl: null, muxPlaybackId: 'mux1' };
        expect(publicRow({ ...row, ...media })).toMatchObject({ ...media, postponedFromId: null, continuationOfId: null });
        expect(publicRow({ ...row, ...media, closedToPublic: true }))
            .toMatchObject({ youtubeUrl: null, videoUrl: null, audioUrl: null, muxPlaybackId: null });
        expect(publicRow({ ...row, ...media, format: 'byCirculation' as const }).muxPlaybackId).toBeNull();
        expect(publicRow({ ...row, ...media, noRecording: true }).muxPlaybackId).toBeNull();
    });
});
