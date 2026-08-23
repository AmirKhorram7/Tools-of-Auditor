/** Isolated Google Meet types. Delete with the meet UI if the feature is cut. */

export const MEET_FEATURE = true;
export const MEET_NEW_URL = "https://meet.google.com/new";

export type WorkMeeting = {
  id: number;
  title: string;
  status: "live" | "ended";
  audience: "all" | "selected";
  meet_url: string | null;
  host_name: string;
  started_at: string;
  ended_at: string | null;
  can_end: boolean;
  is_live: boolean;
  guest_count: number | null;
};

export type WorkMeetingPayload = {
  enabled: boolean;
  can_create: boolean;
  meet_new_url: string;
  results: WorkMeeting[];
};
