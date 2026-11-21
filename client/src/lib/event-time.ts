const eventTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatEventTime(value: string) {
  return eventTime.format(new Date(value));
}

export function localDateTime(value: string) {
  const date = new Date(value);
  const digits = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${digits(date.getMonth() + 1)}-${digits(date.getDate())}T${digits(date.getHours())}:${digits(date.getMinutes())}`;
}
