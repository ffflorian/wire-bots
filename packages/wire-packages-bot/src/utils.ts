import {formatDistance} from 'date-fns';

export function formatUptime(uptime: number): string {
  return formatDistance(0, uptime * 1000, {includeSeconds: true});
}
