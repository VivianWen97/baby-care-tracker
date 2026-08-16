import { describe, it, expect } from 'vitest';
import analyzeContractions from '../src/lib/contractionStats.js';

function makeLog(startMs, durationSec) {
  const start = new Date(startMs).toISOString();
  const end = new Date(startMs + durationSec * 1000).toISOString();
  return { id: startMs, type: 'contraction', startTime: start, endTime: end, duration: durationSec };
}

describe('analyzeContractions', () => {
  const now = Date.now();

  it('detects Early Labor (30-45s, 5-30min apart)', () => {
    const logs = [
      makeLog(now - 10 * 60 * 1000 - 60 * 60 * 1000, 25),
      makeLog(now - 10 * 60 * 1000 - 30 * 60 * 1000, 35),
      makeLog(now - 10 * 60 * 1000, 33),
      makeLog(now - 4 * 60 * 1000, 36),
    ];
    const res = analyzeContractions(logs, now, { shortWindowMs: 60 * 60 * 1000, mediumWindowMs: 6 * 60 * 60 * 1000 });
    expect(res.mediumStats).toBeTruthy();
    expect(Math.round(res.mediumStats.meanDuration)).toBeGreaterThanOrEqual(30);
    expect(Math.round(res.mediumStats.meanDuration)).toBeLessThanOrEqual(45);
    expect(res.stage).toBe('Early Labor');
  });
      

  it('detects Early Labor (30-45s, 5-30min apart)', () => {
    const logs = [
      makeLog(now - 10 * 60 * 1000 - 30 * 60 * 1000, 35),
      makeLog(now - 10 * 60 * 1000, 33),
      makeLog(now - 4 * 60 * 1000, 36),
    ];
    const res = analyzeContractions(logs, now, { shortWindowMs: 60 * 60 * 1000, mediumWindowMs: 6 * 60 * 60 * 1000 });
    expect(res.mediumStats).toBeTruthy();
    expect(Math.round(res.mediumStats.meanDuration)).toBeGreaterThanOrEqual(30);
    expect(Math.round(res.mediumStats.meanDuration)).toBeLessThanOrEqual(45);
    expect(res.stage).toBe('Early Labor');
  });

  it('detects Active Labor (45-60s, 3-5min apart)', () => {
    const logs = [
      makeLog(now - 9 * 60 * 1000, 50),
      makeLog(now - 5 * 60 * 1000, 52),
      makeLog(now - 1 * 60 * 1000, 48),
    ];
    const res = analyzeContractions(logs, now);
    expect(res.mediumStats).toBeTruthy();
    expect(Math.round(res.mediumStats.meanDuration)).toBeGreaterThanOrEqual(45);
    expect(Math.round(res.mediumStats.meanDuration)).toBeLessThanOrEqual(60);
    expect(res.stage).toBe('Active Labor');
  });

  it('detects Transition (60-90s, 1-3min apart)', () => {
    const logs = [
      makeLog(now - 6 * 60 * 1000, 70),
      makeLog(now - 4 * 60 * 1000, 75),
      makeLog(now - 2 * 60 * 1000, 80),
    ];
    const res = analyzeContractions(logs, now);
    expect(res.stage).toBe('Transition');
  });

  it('detects Pushing & Birth (priority over others)', () => {
    const logs = [
      makeLog(now - 3 * 60 * 1000, 65),
      makeLog(now - 2 * 60 * 1000, 68),
      makeLog(now - 1 * 60 * 1000, 62),
    ];
    const res = analyzeContractions(logs, now);
    expect(res.stage).toBe('Pushing & Birth');
  });

  it('returns Insufficient data when too few contractions', () => {
    const logs = [makeLog(now - 10 * 60 * 1000, 40)];
    const res = analyzeContractions(logs, now);
    expect(res.stage).toMatch(/Insufficient data/);
  });

  it('returns Unclear for ambiguous metrics', () => {
    // duration in early range, but interval in active range
    const logs = [
      makeLog(now - 6 * 60 * 1000, 40),
      makeLog(now - 3 * 60 * 1000, 42),
      makeLog(now - 1 * 60 * 1000, 41),
    ];
    const res = analyzeContractions(logs, now);
    expect(res.stage).toBe('Unclear');
  });

  it('detects a single extreme outlier (possible misclick)', () => {
    // three normal contractions and one extreme long duration
    const logs = [
      makeLog(now - 12 * 60 * 1000, 50),
      makeLog(now - 8 * 60 * 1000, 52),
      makeLog(now - 4 * 60 * 1000, 48),
      makeLog(now - 3 * 60 * 1000, 300), // extreme outlier
    ];
    const res = analyzeContractions(logs, now);
    expect(res.outliers).toBeTruthy();
    expect(res.outliers.durationOutliers.length).toBeGreaterThanOrEqual(1);
    expect(res.outlierHypothesis).toMatch(/misclick|erroneous/i);
  });

  it('does not flag outliers for consistent data', () => {
    const logs = [
      makeLog(now - 9 * 60 * 1000, 50),
      makeLog(now - 5 * 60 * 1000, 52),
      makeLog(now - 1 * 60 * 1000, 48),
    ];
    const res = analyzeContractions(logs, now);
    expect(res.outliers).toBeTruthy();
    expect(res.outliers.durationOutliers.length).toBe(0);
    expect(res.outliers.intervalOutliers.length).toBe(0);
    expect(res.outlierHypothesis).toBeNull();
  });
});
