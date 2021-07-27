import {formatDistance} from 'date-fns';

export function formatUptime(uptime: number): string {
  const ONE_SECOND_IN_MILLIS = 1000;
  return formatDistance(0, uptime * ONE_SECOND_IN_MILLIS, {includeSeconds: true});
}
