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
