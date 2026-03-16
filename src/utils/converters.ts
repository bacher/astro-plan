export const DAY_IN_SECONDS = 24 * 60 * 60;
export const AU_IN_M = 1.496e11;

export function daysToSeconds(days: number) {
  return days * DAY_IN_SECONDS;
}
export function auToMeters(au: number) {
  return au * AU_IN_M;
}