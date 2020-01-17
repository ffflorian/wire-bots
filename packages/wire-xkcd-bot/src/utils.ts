import * as moment from 'moment';

export function formatUptime(uptime: number): string {
  const duration = moment.duration(uptime, 'seconds').asMilliseconds();
  return moment.utc(duration).format('HH:mm:ss');
}
