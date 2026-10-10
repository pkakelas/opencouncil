import 'server-only';
import type { Prisma, Realm } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { PUBLIC_CITY_WHERE } from '@/lib/cityStatus';
import { hasPublicRecording } from '@/lib/meetingLifecycleRules';

export const publicMeetingSelect = {
    id: true, cityId: true, name: true, name_en: true, kind: true, sessionNumber: true, dateTime: true,
    format: true, closedToPublic: true, noRecording: true,
    city: { select: { id: true, name: true, name_en: true, timezone: true, realm: true, logoImage: true } },
    administrativeBody: { select: { name: true, name_en: true, showUnreviewedTranscript: true } },
    taskStatuses: { where: { type: 'humanReview', status: 'succeeded' }, take: 1, select: { id: true } },
} satisfies Prisma.CouncilMeetingSelect;
export type PublicMeeting = Prisma.CouncilMeetingGetPayload<{ select: typeof publicMeetingSelect }>;

export const publicSubjectSelect = {
    id: true, name: true, description: true, cityId: true, councilMeetingId: true,
    topic: { select: { name: true, name_en: true, colorHex: true, icon: true } },
    location: { select: { text: true } },
    councilMeeting: { select: publicMeetingSelect },
} satisfies Prisma.SubjectSelect;
export type PublicSubject = Prisma.SubjectGetPayload<{ select: typeof publicSubjectSelect }>;

/**
 * Whether a reader may see the transcript of the meeting: a meeting with no
 * public recording (closed to the public, by circulation, or not recorded)
 * withholds it, also when the transcript exists from before it was marked
 * so, as the meeting page does; a reviewed transcript, or an unreviewed one
 * of a body that shows them, is public.
 */
export const transcriptIsPublic = (meeting: PublicMeeting) =>
    hasPublicRecording(meeting) && (meeting.administrativeBody?.showUnreviewedTranscript !== false || meeting.taskStatuses.length > 0);

export async function getPublicMeeting(cityId: string, meetingId: string, realm: Realm) {
    return prisma.councilMeeting.findFirst({
        where: { cityId, id: meetingId, released: true, city: { ...PUBLIC_CITY_WHERE, realm } }, select: publicMeetingSelect,
    });
}

export async function getPublicSubject(cityId: string, meetingId: string, subjectId: string, realm: Realm) {
    return prisma.subject.findFirst({
        where: { id: subjectId, cityId, councilMeetingId: meetingId, councilMeeting: { released: true, city: { ...PUBLIC_CITY_WHERE, realm } } },
        select: publicSubjectSelect,
    });
}
