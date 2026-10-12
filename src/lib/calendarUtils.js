const NEW_YORK_TIME_ZONE = 'America/New_York';

function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = parts.reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return `${values.year}-${values.month}-${values.day}`;
}

export function buildDailySummary(logs, type) {
  return logs
    .filter((log) => log.type === type)
    .reduce((summary, log) => {
      const dateKey = log.dateKey || (log.timestamp ? getLocalDateKey(new Date(log.timestamp)) : null);
      if (!dateKey) return summary;

      if (!summary[dateKey]) {
        summary[dateKey] = { count: 0, details: [] };
      }

      summary[dateKey].count += 1;
      if (log.detail) summary[dateKey].details.push(log.detail);
      return summary;
    }, {});
}

export function buildDiaperIntervalSummary(logs, birthTimestamp, now = Date.now()) {
  const intervalLength = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(birthTimestamp) || birthTimestamp > now) return [];

  const intervalCount = Math.floor((now - birthTimestamp) / intervalLength) + 1;
  const intervals = Array.from({ length: intervalCount }, (_, index) => ({
    index,
    pee: 0,
    poo: 0,
  }));

  logs.forEach((log) => {
    if (log.type !== 'diaper') return;

    const eventTimestamp = Number.isFinite(log.timestampMs)
      ? log.timestampMs
      : Date.parse(log.timestamp);
    if (!Number.isFinite(eventTimestamp) || eventTimestamp < birthTimestamp || eventTimestamp > now) return;

    const intervalIndex = Math.floor((eventTimestamp - birthTimestamp) / intervalLength);
    const detail = log.detail || '';
    const diaperType = log.diaperType
      || (detail.includes('小便') && detail.includes('大便') ? 'both' : null)
      || (detail.includes('小便') ? 'pee' : null)
      || (detail.includes('大便') ? 'poo' : null);

    if (diaperType === 'pee' || diaperType === 'both') intervals[intervalIndex].pee += 1;
    if (diaperType === 'poo' || diaperType === 'both') intervals[intervalIndex].poo += 1;
  });

  return intervals;
}

export function buildFeedingIntervalSummary(logs, birthTimestamp, now = Date.now()) {
  const intervalLength = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(birthTimestamp) || birthTimestamp > now) return [];

  const intervalCount = Math.floor((now - birthTimestamp) / intervalLength) + 1;
  const intervals = Array.from({ length: intervalCount }, (_, index) => ({
    index,
    count: 0,
    amount: 0,
  }));

  logs.forEach((log) => {
    if (log.type !== 'feeding') return;

    const eventTimestamp = Number.isFinite(log.timestampMs)
      ? log.timestampMs
      : Number.isFinite(Number(log.id))
        ? Number(log.id)
        : Date.parse(log.timestamp);
    if (!Number.isFinite(eventTimestamp) || eventTimestamp < birthTimestamp || eventTimestamp > now) return;

    const intervalIndex = Math.floor((eventTimestamp - birthTimestamp) / intervalLength);
    intervals[intervalIndex].count += 1;
    intervals[intervalIndex].amount += Number(log.amount) || 0;
  });

  return intervals;
}
