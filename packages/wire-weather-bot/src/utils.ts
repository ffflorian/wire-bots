import {formatDistance} from 'date-fns';

export const mapIconToEmoji = (weatherId: number): string => {
  if (
    weatherId.toString().startsWith('2') ||
    weatherId === 900 ||
    weatherId === 901 ||
    weatherId === 902 ||
    weatherId === 905
  ) {
    return '☈';
  } else if (weatherId.toString().startsWith('3')) {
    return 'drizzle';
  } else if (weatherId.toString().startsWith('5')) {
    return '🌧️';
  } else if (weatherId.toString().startsWith('6') || weatherId === 903 || weatherId === 906) {
    return '❄️';
  } else if (weatherId.toString().startsWith('7')) {
    return '';
  } else if (weatherId === 800) {
    return '☀️';
  } else if (weatherId === 801) {
    return '⛅';
  } else if (weatherId === 802 || weatherId === 803) {
    return '☁️️';
  } else if (weatherId === 904) {
    return '🌞';
  }
  return '😎';
};

export function formatUptime(uptime: number): string {
  return formatDistance(0, uptime * 1000, {includeSeconds: true})
}
