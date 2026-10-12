import { describe, it, expect } from 'vitest';
import { buildDailySummary, buildDiaperIntervalSummary, buildFeedingIntervalSummary } from '../src/lib/calendarUtils.js';

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

  it('tallies pee and poop in 24-hour windows measured from birth time', () => {
    const birthTimestamp = Date.UTC(2026, 8, 16, 8);
    const day = 24 * 60 * 60 * 1000;
    const logs = [
      { type: 'diaper', diaperType: 'pee', timestampMs: birthTimestamp + 1_000 },
      { type: 'diaper', diaperType: 'poo', timestampMs: birthTimestamp + day - 1 },
      { type: 'diaper', detail: '小便+大便', timestampMs: birthTimestamp + day },
      { type: 'diaper', diaperType: 'pee', timestampMs: birthTimestamp + 2 * day + 1 },
      { type: 'feeding', timestampMs: birthTimestamp + 2 * day },
      { type: 'diaper', diaperType: 'poo', timestampMs: birthTimestamp - 1 },
    ];

    expect(buildDiaperIntervalSummary(logs, birthTimestamp, birthTimestamp + 2 * day + 2)).toEqual([
      { index: 0, pee: 1, poo: 1 },
      { index: 1, pee: 1, poo: 1 },
      { index: 2, pee: 1, poo: 0 },
    ]);
  });

  it('tallies feeding counts and bottle amounts in 24-hour windows from birth', () => {
    const birthTimestamp = Date.UTC(2026, 8, 16, 8);
    const day = 24 * 60 * 60 * 1000;
    const logs = [
      { type: 'feeding', id: birthTimestamp + 1_000, amount: 60 },
      { type: 'feeding', timestampMs: birthTimestamp + day - 1, amount: null },
      { type: 'feeding', timestampMs: birthTimestamp + day, amount: 90 },
      { type: 'feeding', timestampMs: birthTimestamp + 2 * day + 1, amount: 30 },
      { type: 'diaper', timestampMs: birthTimestamp + day, amount: 20 },
      { type: 'feeding', timestampMs: birthTimestamp - 1, amount: 40 },
    ];

    expect(buildFeedingIntervalSummary(logs, birthTimestamp, birthTimestamp + 2 * day + 2)).toEqual([
      { index: 0, count: 2, amount: 60 },
      { index: 1, count: 1, amount: 90 },
      { index: 2, count: 1, amount: 30 },
    ]);
  });
});
