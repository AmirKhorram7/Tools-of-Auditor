import { cx } from "@/components/ui";
import type { ReminderChannel } from "@/lib/reminders";

export default function ChannelIcon({
  channel,
  className,
}: {
  channel: ReminderChannel;
  className?: string;
}) {
  const box = cx("inline-flex size-5 items-center justify-center", className);
  if (channel === "telegram") {
    return (
      <svg viewBox="0 0 24 24" className={box} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#26A5E4" />
        <path
          fill="#fff"
          d="M17.6 7.2 5.9 11.7c-.8.3-.8.8-.2 1l3 1 1.2 3.6c.1.4.3.5.6.5.3 0 .4-.1.6-.3l1.7-1.6 3.3 2.4c.6.3 1 .2 1.2-.6l2.1-9.8c.2-.9-.3-1.3-1-1z"
        />
      </svg>
    );
  }
  if (channel === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" className={box} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#25D366" />
        <path
          fill="#fff"
          d="M12 6.2a5.7 5.7 0 0 0-4.9 8.6L6.2 18l3.3-.9A5.8 5.8 0 1 0 12 6.2Zm3.3 8.1c-.1.4-.8.8-1.1.8-.3 0-.6.2-2-.7-1.7-1.1-2.7-2.6-2.8-2.7-.1-.1-.8-1-.8-1.9s.5-1.3.7-1.5c.1-.1.3-.2.5-.2h.4c.1 0 .3 0 .4.3l.5 1.2c.1.2 0 .3 0 .5l-.3.4c-.1.1-.2.3-.1.4.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.4.1.5 0l.6-.7c.1-.1.3-.1.5 0l1.2.6c.2.1.3.2.4.3 0 .4-.1 1.1-.5 1.4Z"
        />
      </svg>
    );
  }
  if (channel === "sms") {
    return (
      <svg viewBox="0 0 24 24" className={box} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#37475a" />
        <path
          fill="#fff"
          d="M7 8.2h10c.6 0 1 .4 1 1v5.2c0 .6-.4 1-1 1H13l-2.6 2.2c-.3.2-.6 0-.6-.3v-1.9H7c-.6 0-1-.4-1-1V9.2c0-.6.4-1 1-1Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={box} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#007185" />
      <path
        fill="#fff"
        d="M7.2 8h9.6c.7 0 1.2.5 1.2 1.1v5.8c0 .6-.5 1.1-1.2 1.1H7.2c-.7 0-1.2-.5-1.2-1.1V9.1c0-.6.5-1.1 1.2-1.1Zm.4 1.3 4.4 2.8 4.4-2.8v-.4L12 12 7.6 9.3v.4Z"
      />
    </svg>
  );
}
