import { NextResponse } from 'next/server';
import { getMeetingDataCore } from '@/lib/getMeetingData';
import { toPublicApiMeeting, withoutMedia } from '@/lib/meetingPublic';
import { hasPublicRecording } from '@/lib/meetingLifecycleRules';
import { handleApiError } from '@/lib/api/errors';
import { isUserAuthorizedToEdit, withUserAuthorizedToEdit } from '@/lib/auth';
import { meetingSchema } from '@/lib/zod-schemas/meeting';
import { updateMeetingWithEffects } from '@/lib/meetingWrites';
import { getCouncilMeetingDirect } from '@/lib/db/meetings';

export async function GET(
    request: Request,
    props: { params: Promise<{ cityId: string; meetingId: string }> }
) {
    const params = await props.params;
    try {
        const data = await getMeetingDataCore(params.cityId, params.meetingId);
        // No auth on this endpoint: the meeting carries its display names and
        // never the id of the meeting that it replaced.
        // A meeting with no public recording gives a reader no transcript and
        // no media. An editor of the city keeps both, to export them.
        const withheld = !hasPublicRecording(data.meeting)
            && !(await isUserAuthorizedToEdit({ cityId: params.cityId }));
        const meeting = toPublicApiMeeting(withheld ? withoutMedia(data.meeting) : data.meeting, {
            timezone: data.city.timezone,
            postponedFromDate: data.meeting.postponedFromDate,
        });
        // Strip transcript data when hidden for review
        if (data.transcriptHiddenForReview || withheld) {
            return NextResponse.json({ ...data, meeting, transcript: [], speakerTags: [] });
        }
        return NextResponse.json({ ...data, meeting });
    } catch (error) {
        // TODO: Brittle string match — refactor getMeetingData to return null instead of throwing
        if (error instanceof Error && error.message === 'Required data not found') {
            return NextResponse.json(
                { error: 'Meeting not found' },
                { status: 404 }
            );
        }
        console.error('Failed to fetch meeting:', error);
        return NextResponse.json(
            { error: 'Failed to fetch meeting' },
            { status: 500 }
        );
    }
}

/** An empty value clears the field; an omitted one leaves it as it is. */
function emptyToNull(value: string | null | undefined): string | null | undefined {
    return value === undefined ? undefined : value || null;
}

export async function PUT(
    request: Request,
    props: { params: Promise<{ cityId: string; meetingId: string }> }
) {
    const params = await props.params;
    try {
        await withUserAuthorizedToEdit({ cityId: params.cityId, councilMeetingId: params.meetingId });
        const body = await request.json();
        // The URL names the meeting, and an edit queues no agenda task. Every
        // other field of the schema is a field of the record, so a field that
        // the schema gains reaches the update without a list here.
        const {
            meetingId: _meetingId, processAgenda: _processAgenda,
            date, youtubeUrl, agendaUrl, administrativeBodyId, ...record
        } = meetingSchema.parse(body);

        // Moving the meeting to another body, or to no body, needs rights on
        // the destination too: a body admin may not hand their meeting over or
        // take a meeting of another body.
        const current = await getCouncilMeetingDirect(params.cityId, params.meetingId);
        if (!current) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }
        const nextBodyId = administrativeBodyId || null;
        if (nextBodyId !== current.administrativeBodyId) {
            await withUserAuthorizedToEdit(nextBodyId
                ? { cityId: params.cityId, administrativeBodyId: nextBodyId }
                : { cityId: params.cityId });
        }

        // A field that the request leaves out keeps its value.
        const meeting = await updateMeetingWithEffects(params.cityId, params.meetingId, {
            ...record,
            dateTime: date,
            youtubeUrl: emptyToNull(youtubeUrl),
            agendaUrl: emptyToNull(agendaUrl),
            administrativeBodyId: emptyToNull(administrativeBodyId),
        });

        return NextResponse.json(meeting);
    } catch (error) {
        return handleApiError(error, 'Failed to update meeting');
    }
}
