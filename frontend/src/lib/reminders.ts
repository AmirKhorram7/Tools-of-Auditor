export type ReminderChannel = "email" | "telegram" | "whatsapp" | "sms";
export type ReminderMode = "before" | "at";
export type ReminderStatus = "scheduled" | "sent" | "failed" | "skipped";

export const CHANNELS: ReminderChannel[] = ["email", "telegram", "whatsapp", "sms"];

export type ChannelStatus = {
  channel: ReminderChannel;
  available: boolean;
  has_address: boolean;
};

export type ReminderContact = {
  email: string;
  telegram_chat_id: string;
  whatsapp_number: string;
  sms_number: string;
};

export type ReminderGroup = {
  id: number;
  name: string;
  channels: ReminderChannel[];
  mode: ReminderMode;
  offset_days: number;
  at_time: string | null;
  fixed_at: string | null;
  created_at: string;
};

export type Reminder = {
  id: number;
  target_type: string;
  target_id: number;
  group: number | null;
  group_name: string | null;
  channels: ReminderChannel[];
  mode: ReminderMode;
  offset_days: number;
  at_time: string | null;
  fixed_at: string | null;
  send_at: string;
  status: ReminderStatus;
  results: Record<string, string>;
  sent_at: string | null;
  created_at: string;
};

export type ReminderDraft = {
  group?: number;
  channels: ReminderChannel[];
  mode: ReminderMode;
  offset_days: number;
  at_time: string;
  fixed_at: string;
};

export function emptyDraft(): ReminderDraft {
  return {
    channels: ["sms"],
    mode: "before",
    offset_days: 1,
    at_time: "09:00",
    fixed_at: "",
  };
}

export function timeHm(value: string | null | undefined): string {
  if (!value) return "09:00";
  const stamp = value.indexOf("T");
  if (stamp >= 0) return value.slice(stamp + 1, stamp + 6);
  return value.slice(0, 5);
}

export function toReminderBody(draft: ReminderDraft): Record<string, unknown> {
  if (draft.group) return { group: draft.group };
  if (draft.mode === "at") {
    return { channels: draft.channels, mode: "at", fixed_at: draft.fixed_at };
  }
  return {
    channels: draft.channels,
    mode: "before",
    offset_days: draft.offset_days,
    at_time: draft.at_time,
  };
}
