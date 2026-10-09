import type { MeetingFormat, MeetingKind, MeetingScheduleStatus } from '@prisma/client';
import { MEETING_FORMATS, hasPublicRecording, type RecordingFields } from '@/lib/meetingLifecycleRules';
import { meetingDisplayName, meetingLabel, type MeetingNameFields } from '@/lib/meetingName';

/**
 * The public projections of a meeting. The new meeting of a postponement
 * carries `postponedFromId`, and the postponed meeting is not public once its
 * new meeting is released. A reader may learn the date for which the meeting
 * was first scheduled, but never the id of the hidden meeting. The first
 * part of a continuation may be a draft, so its id stays private too.
 */

/**
 * Where a meeting takes place: its own place, else the hall of its body. Null
 * for a format that has no place, such as a teleconference.
 */
export function effectivePlace(
    meeting: { format: MeetingFormat; place: string | null; administrativeBody?: { place?: string | null } | null },
): string | null {
    if (!MEETING_FORMATS[meeting.format].showsPlace) return null;
    return meeting.place ?? meeting.administrativeBody?.place ?? null;
}

type MediaFields = { youtubeUrl: string | null; videoUrl: string | null; audioUrl: string | null; muxPlaybackId: string | null };

/**
 * A meeting with no public recording (closed to the public, by circulation,
 * or not recorded) as a reader receives it: no media to play. An editor of the
 * city still receives the media.
 */
export function withoutMedia<T extends MediaFields>(row: T): T {
    return { ...row, youtubeUrl: null, videoUrl: null, audioUrl: null, muxPlaybackId: null };
}

/** A row for a server-rendered page or a public list: the same shape, with no link to another meeting. */
export function hideLinks<T extends { postponedFromId: string | null; continuationOfId: string | null }>(row: T): T {
    return { ...row, postponedFromId: null, continuationOfId: null };
}

/**
 * A row of a public list: no link to another meeting, and no media of a
 * meeting that has no public recording.
 */
export function publicRow<T extends { postponedFromId: string | null; continuationOfId: string | null } & RecordingFields & MediaFields>(row: T): T {
    const linked = hideLinks(row);
    return hasPublicRecording(row) ? linked : withoutMedia(linked);
}

type RecordSource = RecordingFields & {
    scheduleStatus: MeetingScheduleStatus;
    scheduleStatusReason: string | null;
    kind: MeetingKind | null;
    sessionNumber: number | null;
    place: string | null;
    administrativeBody?: { place?: string | null } | null;
};

/**
 * The record of a meeting as a reader may see it: whether it takes place,
 * its kind, number and format, and where. The REST API and the MCP tools
 * both return it.
 */
export function publicRecordFields(meeting: RecordSource, postponedFromDate: Date | null) {
    return {
        scheduleStatus: meeting.scheduleStatus,
        scheduleStatusReason: meeting.scheduleStatusReason,
        kind: meeting.kind,
        sessionNumber: meeting.sessionNumber,
        format: meeting.format,
        closedToPublic: meeting.closedToPublic,
        noRecording: meeting.noRecording,
        place: effectivePlace(meeting),
        postponedFromDate: postponedFromDate?.toISOString() ?? null,
    };
}

type ApiMeetingSource = MeetingNameFields & RecordSource & {
    postponedFromId: string | null;
    continuationOfId: string | null;
    hiddenByPostponement?: boolean;
    administrativeBody?: (MeetingNameFields['administrativeBody'] & { place?: string | null }) | null;
};

type ReplacedKeys = 'postponedFromId' | 'continuationOfId' | 'hiddenByPostponement' | 'name' | 'name_en' | 'place';

export type PublicApiMeeting<T extends ApiMeetingSource> = Omit<T, ReplacedKeys>
    & ReturnType<typeof publicRecordFields>
    & { name: string; name_en: string; title: string; title_en: string };

/**
 * A meeting in a public API response. `name` and `name_en` hold the label,
 * which a client can print on its own, as it did before the names were
 * derived. `title` and `title_en` hold the short title. The links to other
 * meetings are left out.
 */
export function toPublicApiMeeting<T extends ApiMeetingSource>(
    row: T,
    { timezone, postponedFromDate }: { timezone: string; postponedFromDate: Date | null },
): PublicApiMeeting<T> {
    const {
        postponedFromId: _postponed, continuationOfId: _continuation, hiddenByPostponement: _hidden,
        name: _name, name_en: _nameEn, place: _place, ...rest
    } = row;
    return {
        ...rest,
        ...publicRecordFields(row, postponedFromDate),
        name: meetingLabel(row, 'el', timezone),
        name_en: meetingLabel(row, 'en', timezone),
        title: meetingDisplayName(row, 'el', timezone),
        title_en: meetingDisplayName(row, 'en', timezone),
    };
}
