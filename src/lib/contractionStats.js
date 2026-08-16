export function analyzeContractions(logs, now = Date.now(), opts = {}) {
  const shortWindowMs = opts.shortWindowMs ?? 60 * 60 * 1000;
  const mediumWindowMs = opts.mediumWindowMs ?? 6 * 60 * 60 * 1000;
  const cap = opts.cap ?? 50;

  const all = (logs || [])
    .filter((l) => l.type === 'contraction' && l.startTime && l.endTime)
    .map((l) => ({
      id: l.id,
      start: new Date(l.startTime).getTime(),
      end: new Date(l.endTime).getTime(),
      duration: l.duration ?? Math.round((new Date(l.endTime) - new Date(l.startTime)) / 1000),
    }))
    .sort((a, b) => a.start - b.start);

  const inWindow = (item, windowMs) => item.start >= now - windowMs;
  const takeWindow = (windowMs) => all.filter((c) => inWindow(c, windowMs));

  const shortList = takeWindow(shortWindowMs);
  const mediumList = takeWindow(mediumWindowMs).slice(-cap);

  const computeArrays = (arr) => {
    const durations = arr.map((a) => a.duration);
    const starts = arr.map((a) => a.start);
    const intervals = starts.slice(1).map((s, i) => Math.round((s - starts[i]) / 1000));
    return { durations, intervals };
  };

  const mean = (xs) => (xs && xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const stddev = (xs) => {
    if (!xs || xs.length === 0) return null;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
  };

  const statsFrom = (arr) => {
    if (!arr || arr.length === 0) return null;
    const { durations, intervals } = computeArrays(arr);
    const cvIntervals = (() => {
      const s = stddev(intervals);
      const m = mean(intervals);
      return s !== null && m ? s / m : null;
    })();
    return {
      count: arr.length,
      meanDuration: mean(durations),
      meanInterval: mean(intervals),
      cvIntervals,
    };
  };

  const shortStats = statsFrom(shortList);
  const mediumStats = statsFrom(mediumList);

  const inRange = (val, [min, max]) => val !== null && val !== undefined && val >= min && val <= max;

  // Use average (mean) for stage detection
  const detectStage = (s) => {
    if (!s || s.count < 1) return { stage: 'Insufficient data', reason: 'no contractions' };
    const d = s.meanDuration;
    const i = s.meanInterval;
    const matches = {
      pushing: d && inRange(d, [60, 90]),
      transition: d && inRange(d, [60, 90]) && i && inRange(i, [60, 180]),
      active: d && inRange(d, [45, 60]) && i && inRange(i, [180, 300]),
      early: d && inRange(d, [30, 45]) && i && inRange(i, [300, 1800]),
    };
    if (matches.pushing) return { stage: 'Pushing & Birth' };
    if (matches.transition) return { stage: 'Transition' };
    if (matches.active) return { stage: 'Active Labor' };
    if (matches.early) return { stage: 'Early Labor' };
    if (s.count < 3) return { stage: 'Insufficient data', reason: 'few contractions' };
    return { stage: 'Unclear', reason: 'ambiguous metrics' };
  };

  // Outlier detection (z-score > 3) on medium list
  const detectOutliers = (arr) => {
    if (!arr || arr.length === 0) return { durationOutliers: [], intervalOutliers: [] };
    const durations = arr.map((a) => a.duration);
    const starts = arr.map((a) => a.start);
    const intervals = starts.slice(1).map((s, i) => Math.round((s - starts[i]) / 1000));
    const meanDur = mean(durations);
    const sdDur = stddev(durations);
    const meanInt = mean(intervals);
    const sdInt = stddev(intervals);

    const durationOutliers = sdDur
      ? arr
          .map((a) => ({ id: a.id, start: a.start, duration: a.duration, z: (a.duration - meanDur) / sdDur }))
          .filter((x) => Math.abs(x.z) >= 3)
      : [];

    const intervalOutliers = sdInt
      ? intervals
          .map((val, idx) => ({
            between: [arr[idx].id, arr[idx + 1].id],
            interval: val,
            z: (val - meanInt) / sdInt,
          }))
          .filter((x) => Math.abs(x.z) >= 3)
      : [];

    return { durationOutliers, intervalOutliers };
  };

  const mediumStage = detectStage(mediumStats);
  const outliers = detectOutliers(mediumList);
  let outlierHypothesis = null;
  const totalOut = (outliers.durationOutliers.length || 0) + (outliers.intervalOutliers.length || 0);
  if (totalOut > 0) {
    if (totalOut === 1) {
      outlierHypothesis = 'Detected a single extreme value — possible misclick or erroneous entry.';
    } else {
      outlierHypothesis = 'Multiple extreme values detected — data may be inconsistent.';
    }
  }

  return {
    allCount: all.length,
    shortList,
    mediumList,
    shortStats,
    mediumStats,
    stage: mediumStage.stage || 'Unclear',
    stageReason: mediumStage.reason || null,
    outliers,
    outlierHypothesis,
  };
}

export default analyzeContractions;
