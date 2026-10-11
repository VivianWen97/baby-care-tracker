import { describe, it, expect } from 'vitest';
import { buildDailySummary } from '../src/lib/calendarUtils.js';

describe('calendarUtils', () => {
  it('groups diaper logs by local date and keeps their labels', () => {
    const logs = [
      { type: 'diaper', dateKey: '2026-09-16', detail: '小便' },
      { type: 'diaper', dateKey: '2026-09-16', detail: '大便' },
      { type: 'diaper', dateKey: '2026-09-17', detail: '小便+大便' },
    ];

    expect(buildDailySummary(logs, 'diaper')).toEqual({
      '2026-09-16': { count: 2, details: ['小便', '大便'] },
      '2026-09-17': { count: 1, details: ['小便+大便'] },
    });
  });
});
