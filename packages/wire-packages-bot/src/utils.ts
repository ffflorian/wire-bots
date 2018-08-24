const toHHMMSS = (input: string): string => {
  const pad = (t: number) => (t < 10 ? '0' + t : t);

  const uptime = parseInt(input, 10);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime - hours * 3600) / 60);
  const seconds = uptime - hours * 3600 - minutes * 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export {toHHMMSS};
