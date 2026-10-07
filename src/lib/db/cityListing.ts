// The shape of a city row in a listing, shared by the session path
// (cities.ts) and the service-key path (citiesAdmin.ts): the two must count
// the same things, or the same request answers differently by how it signed
// in. Not a "use server" module, so it may export values.
import "server-only";
import { primaryMeetingWhere } from '@/lib/utils/bodyTier';

/**
 * The counts a city listing shows. The meeting count is the primary tier
 * (#829): a secondary body's meetings show only where a reader asks for them.
 */
export const CITY_COUNT_SELECT = {
    select: {
        persons: true,
        parties: true,
        councilMeetings: {
            where: {
                released: true,
                ...primaryMeetingWhere,
            },
        },
    },
};

export const CITY_ORDER_BY = [
    // supported > demo > pending, by CityStatus declaration order
    { status: 'desc' as const },
    { name: 'asc' as const },
];
