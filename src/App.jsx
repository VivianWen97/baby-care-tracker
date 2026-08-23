import React, { useState, useEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { Timer, Milk, Toilet, Moon, History, Trash2, Play, Square, Plus, Bell, Users } from 'lucide-react';
import analyzeContractions, { getContractionChartRange } from './lib/contractionStats';
import { db } from './firebase';
import { ref, onValue, set } from 'firebase/database';

export default function App() {
  const [activeTab, setActiveTab] = useState('contraction');
  const [alertMessage, setAlertMessage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('family_room_code') || '');
  const [inputCode, setInputCode] = useState('');
  const [roomLoadKey, setRoomLoadKey] = useState(0);
  const [birthStats, setBirthStats] = useState({
    birthDate: '',
    birthTime: '',
    weight: '',
    height: '',
    mainCondition: '',
    issues: [],
    condition: '',
  });

  // Listen to Firebase updates in real time whenever roomCode changes
  useEffect(() => {
    if (!roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}/logs`);
    const birthStatsRef = ref(db, `rooms/${roomCode}/birthStats`);
    const unsubscribeLogs = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLogs(Object.values(data).filter(Boolean).sort((first, second) => second.id - first.id));
        return;
      }
      setLogs([]);
    }, (error) => {
      console.error('Failed to load room history:', error);
      setLogs([]);
    });
    const unsubscribeBirthStats = onValue(birthStatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBirthStats({
          birthDate: data.birthDate || '',
          birthTime: data.birthTime || '',
          weight: data.weight || '',
          height: data.height || '',
          mainCondition: data.mainCondition || '',
          issues: Array.isArray(data.issues) ? data.issues : [],
          condition: data.condition || '',
        });
        return;
      }
      setBirthStats({ birthDate: '', birthTime: '', weight: '', height: '', mainCondition: '', issues: [], condition: '' });
    }, (error) => {
      console.error('Failed to load birth stats:', error);
    });
    return () => {
      unsubscribeLogs();
      unsubscribeBirthStats();
    };
  }, [roomCode, roomLoadKey]);

  // Helper to sync new logs back to Firebase
  const saveLogsToCloud = (updatedLogs) => {
    if (!roomCode) return;
    const logsById = updatedLogs.reduce((entries, log) => {
      entries[String(log.id)] = log;
      return entries;
    }, {});

    set(ref(db, `rooms/${roomCode}/logs`), logsById).catch((error) => {
      console.error('Failed to save room history:', error);
    });
  };

  const updateLogs = (updatedLogs) => {
    setLogs(updatedLogs);
    saveLogsToCloud(updatedLogs);
  };

  // Save birth stats to Firebase as log and separate birthStats object
  const saveBirthStats = () => {
    if (!birthStats.birthDate || !birthStats.birthTime || !birthStats.weight) {
      return showAlert('请填写出生日期、时间和体重');
    }
    const normalizedBirthStats = {
      ...birthStats,
      height: birthStats.height.trim(),
      issues: birthStats.issues,
      condition: birthStats.condition.trim(),
    };
    const birthLog = {
      id: Date.now(),
      type: 'birth',
      timestamp: `${normalizedBirthStats.birthDate} ${normalizedBirthStats.birthTime}`,
      ...normalizedBirthStats,
    };
    set(ref(db, `rooms/${roomCode}/birthStats`), {
      ...normalizedBirthStats,
    }).then(() => {
      updateLogs([birthLog, ...logs.filter((log) => log.type !== 'birth')]);
      showAlert('已保存出生信息！快去和宝宝有爱的skin-to-skin吧！');
    }).catch((error) => {
      console.error('Failed to save birth stats:', error);
      showAlert('保存失败，请稍后重试');
    });
  };

  // Re-enter or create a family room code
  const joinRoom = () => {
    const formatted = inputCode.trim().toLowerCase();
    if (!formatted) return alert('请输入家庭暗号/房间号');

    setLogs([]);
    setRoomCode(formatted);
    setRoomLoadKey((currentKey) => currentKey + 1);
    localStorage.setItem('family_room_code', formatted);
  };

  // Contraction Timer
  const [isTiming, setIsTiming] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const chartRef = useRef(null);
  const [dismissedOutlierKey, setDismissedOutlierKey] = useState(null);

  useEffect(() => {
    setIsTiming(false);
    setStartTime(null);
    setElapsed(0);
  }, [roomCode]);

  const showAlert = (message) => {
    setAlertMessage(message);
  };

  useEffect(() => {
    let interval = null;
    if (isTiming) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTiming, startTime]);

  const toggleContraction = () => {
    if (!isTiming) {
      setIsTiming(true);
      setStartTime(Date.now());
      setElapsed(0);
    } else {
      setIsTiming(false);
      const startedAt = new Date(startTime);
      const endedAt = new Date(startTime + elapsed * 1000);
      const lastEndTime = logs
        .filter((log) => log.type === 'contraction' && log.endTime)
        .map((log) => new Date(log.endTime).getTime())
        .filter((time) => Number.isFinite(time) && time <= startedAt.getTime())
        .reduce((latest, time) => Math.max(latest, time), null);
      const newLog = {
        id: Date.now(),
        type: 'contraction',
        timestamp: startedAt.toLocaleString('en-US', {timeZone: 'America/New_York'}),
        startTime: startedAt.toISOString(),
        endTime: endedAt.toISOString(),
        duration: elapsed,
        ...(lastEndTime !== null && {
          interval: Number(((startedAt.getTime() - lastEndTime) / 60000).toFixed(1)),
        }),
      };
      updateLogs([newLog, ...logs]);
    }
  };

  const contractionSeries = useMemo(() => {
    return logs
      .filter((log) => log.type === 'contraction' && log.startTime && log.endTime)
      .map((log, index) => {
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        const midpoint = start + (end - start) / 2;

        return {
          name: `宫缩 ${index + 1}`,
          data: [
            { x: start, y: 0 },
            { x: midpoint, y: 3 },
            { x: end, y: 0 },
          ],
        };
      });
  }, [logs]);

  // Compute chart range for better visualization
  const contractionChartRange = useMemo(() => getContractionChartRange(logs), [logs]);
  const contractionChartDateRange = useMemo(() => {
    if (!contractionChartRange) return '暂无日期';

    const formatter = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'America/New_York',
    });

    const startDate = formatter.format(contractionChartRange.min);
    const endDate = formatter.format(contractionChartRange.max);

    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  }, [contractionChartRange]);

  useEffect(() => {
    if (activeTab !== 'contraction' || !chartRef.current) return;

    const computedStyle = getComputedStyle(document.documentElement);
    const brandColor = computedStyle.getPropertyValue('--color-fg-brand').trim() || '#4bce97';

    const options = {
      chart: {
        height: '260px',
        width: '100%',
        type: 'line',
        fontFamily: 'Inter, sans-serif',
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: false,
          },
        },
      },
      series: contractionSeries.map((series) => ({
        ...series,
        color: brandColor,
      })),
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      grid: {
        show: true,
        strokeDashArray: 4,
        padding: {
          left: 2,
          right: 2,
          top: -10,
        },
      },
      xaxis: {
        type: 'datetime',
        ...(contractionChartRange || {}),
        labels: {
          show: true,
          datetimeUTC: false,
          style: {
            fontFamily: 'Inter, sans-serif',
          },
        },
      },
      yaxis: {
        min: 0,
        max: 5,
        labels: {
          show: false,
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      legend: {
        show: false,
      },
      dataLabels: {
        enabled: false,
      },
      tooltip: {
        x: {
          format: 'yyyy-MM-dd HH:mm:ss',
        },
      },
    };

    const chart = new ApexCharts(chartRef.current, options);
    chart.render();

    return () => {
      chart.destroy();
    };
  }, [activeTab, contractionSeries]);

  // Contraction statistics, stage detection (moved to utility)
  const contractionStats = useMemo(() => analyzeContractions(logs), [logs]);

  // Alerting: hospital alert for Active stage consistency and epidural tip
  useEffect(() => {
    const stat = contractionStats;
    if (!stat) return;

    const now = Date.now();

    const getLast = (key) => {
      try {
        const v = localStorage.getItem(key);
        return v ? parseInt(v, 10) : 0;
      } catch (e) {
        return 0;
      }
    };
    const setLast = (key, ts) => {
      try {
        localStorage.setItem(key, String(ts));
      } catch (e) {}
    };

    // Active hospital alert: short window criteria
    const s = stat.shortStats;
    const lastHosp = getLast('last_hospital_alert') || 0;
    let hospitalAlertDetected = lastHosp > 0;
    if (s && s.count >= 3) {
      const isActiveMean = s.meanDuration && s.meanInterval && s.meanDuration >= 45 && s.meanDuration <= 60 && s.meanInterval >= 180 && s.meanInterval <= 300;
      const consistent = s.cvIntervals !== null ? s.cvIntervals < 0.35 : true;
      const hospCooldown = 60 * 60 * 1000; // 1 hour
      if (isActiveMean && consistent && now - lastHosp > hospCooldown) {
        hospitalAlertDetected = true;
        showAlert('宫缩进入活跃期且持续,可以前往医院。');
        setLast('last_hospital_alert', now);
        const newLog = {
          id: Date.now(),
          type: 'alert',
          timestamp: new Date(now).toLocaleString('en-US', {timeZone: 'America/New_York'}),
          detail: '恭喜妈妈！宫缩进入活跃期且持续,可以前往医院。',
        };
        setLogs((currentLogs) => {
          const updatedLogs = [newLog, ...currentLogs];
          saveLogsToCloud(updatedLogs);
          return updatedLogs;
        });
      }
    }

    // Epidural tip is only available after a hospital alert has been detected and when approx 4 minutes apart.
    if (hospitalAlertDetected && s && s.meanInterval && s.meanInterval <= 240 && s.count >= 2) {
      const lastEpi = getLast('last_epidural_tip') || 0;
      const epiCooldown = 6 * 60 * 60 * 1000; // 6 hours
      if (now - lastEpi > epiCooldown) {
        // show non-blocking tip in UI by storing a flag; also show a quick alert
        showAlert('温馨提示:宫缩间隔约4分钟,若需要,可向医护人员咨询epidural。');
        setLast('last_epidural_tip', now);
        const newLog = {
          id: Date.now(),
          type: 'alert',
          timestamp: new Date(now).toLocaleString('en-US', {timeZone: 'America/New_York'}),
          detail: '温馨提示:宫缩间隔约4分钟,若需要,可向医护人员咨询epidural。',
        };
        setLogs((currentLogs) => {
          const updatedLogs = [newLog, ...currentLogs];
          saveLogsToCloud(updatedLogs);
          return updatedLogs;
        });
      }
    }
  }, [contractionStats]);

  // Feeding Tracker
  const [feedType, setFeedType] = useState('breast_left');
  const [feedAmount, setFeedAmount] = useState('');

  const addFeedingLog = () => {
    if ((feedType === 'formula_bottle' || feedType === 'pump_bottle') && !feedAmount) {
      return showAlert('请输入喂奶毫升数');
    }
    const newLog = {
      id: Date.now(),
      type: 'feeding',
      detail: feedType === 'bottle' ? `瓶喂 ${feedAmount} ml` : `亲喂 (${feedType === 'breast_left' ? '左侧' : '右侧'})`,
      timestamp: new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}),
    };
    updateLogs([newLog, ...logs]);
    setFeedAmount('');
    showAlert('已记录喂奶！');
  };

  // Diaper Tracker
  const [diaperType, setDiaperType] = useState('pee');
  const [diaperNote, setDiaperNote] = useState('');

  const addDiaperLog = () => {
    const labels = { pee: '小便', poo: '大便', both: '小便+大便' };
    const newLog = {
      id: Date.now(),
      type: 'diaper',
      detail: labels[diaperType] + (diaperNote ? ` (${diaperNote})` : ''),
      timestamp: new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}),
    };
    updateLogs([newLog, ...logs]);
    setDiaperNote('');
    showAlert('已记录换尿裤！');
  };

  const deleteLog = (id) => {
    updateLogs(logs.filter((log) => log.id !== id));
  };

  // If no family room code is set, ask user to enter one
  if (!roomCode) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col justify-center p-6">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 text-center space-y-4">
          <Users size={48} className="mx-auto text-green-600" />
          <h2 className="text-xl font-bold text-slate-800">设置家庭共享房间</h2>
          <p className="text-xs text-slate-500">
            宝妈和宝爸输入相同的“家庭暗号”，即可跨手机实时同步所有记录。
          </p>
          <input
            type="text"
            placeholder="例如: baby-2026"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-center text-lg font-bold"
          />
          <button
            onClick={joinRoom}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold"
          >
            进入 / 创建房间
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-green-300 text-white p-4 text-center font-bold text-lg shadow-md">
        <span className="font-bold text-lg">🦖小恐龙破壳日记录&新生护理助手🦖</span>
      </header>
      <button
          onClick={() => {
            localStorage.removeItem('family_room_code');
            setRoomCode('');
          }}
          className="text-xs text-white text-left bg-gray-400 px-2 py-1 rounded border border-gray-400 opacity-80"
        >
          共享房间号: {roomCode}
      </button>
      <main className="flex-1 p-4 pb-20">
        {activeTab === 'contraction' && (
          <div className="flex flex-col items-center justify-center space-y-6 pt-8">
            <div className="text-center">
              <h2 className="text-slate-500 font-medium">宫缩计时</h2>
              <div className="text-6xl font-mono font-bold my-4 text-green-300">
                {Math.floor(elapsed / 60).toString().padStart(2, '0')}:
                {(elapsed % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <button
              onClick={toggleContraction}
              className={`w-40 h-40 rounded-full flex flex-col items-center justify-center text-white text-xl font-bold shadow-lg transition-transform active:scale-95 ${
                isTiming ? 'bg-rose-500 hover:bg-rose-600' : 'bg-green-300 hover:bg-green-700'
              }`}
            >
              {isTiming ? <Square size={36} className="mb-2" /> : <Play size={36} className="mb-2 ml-1" />}
              {isTiming ? '停止宫缩' : '开始宫缩'}
            </button>
            
            <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex justify-between mb-4 md:mb-6">
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <h5 className="inline-flex items-center text-slate-600">宫缩趋势</h5>
                    <p className="text-slate-800 text-xl font-semibold">{contractionChartDateRange}</p>
                  </div>
                </div>
              </div>
              {contractionSeries.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                  还没有宫缩记录，开始计时后会显示在这里。
                </div>
              ) : (
                <div ref={chartRef} className="h-64 w-full" />
              )}
              {/* Contraction stats card */}
              <div className="mt-4 border-t pt-4">
                {contractionStats && (
                  <div className="text-sm text-slate-700">
                    {(() => {
                      const key = contractionStats.outlierHypothesis ? contractionStats.outlierHypothesis + JSON.stringify(contractionStats.outliers) : null;
                      const show = key && dismissedOutlierKey !== key;
                      if (!show) return null;
                      return (
                        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex justify-between items-start">
                          <div>
                            <div className="font-semibold">数据异常提示</div>
                            <div className="mt-1">{contractionStats.outlierHypothesis}</div>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <button
                              onClick={() => setDismissedOutlierKey(key)}
                              className="px-3 py-1 bg-amber-200 rounded text-xs text-amber-900"
                            >
                              关闭
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-xs text-slate-500">平均持续时间</div>
                        <div className="text-lg font-semibold">
                          {contractionStats.mediumStats && contractionStats.mediumStats.meanDuration
                            ? `${Math.round(contractionStats.mediumStats.meanDuration)} 秒`
                            : '—'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">平均间隔</div>
                        <div className="text-lg font-semibold">
                          {contractionStats.mediumStats && contractionStats.mediumStats.meanInterval
                            ? `${(contractionStats.mediumStats.meanInterval / 60).toFixed(1)} 分钟`
                            : '—'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">检测阶段</div>
                        <div className="text-lg font-semibold">{contractionStats.stage}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">最近 6 小时 历史数: {contractionStats.mediumList.length}，最近 1 小时: {contractionStats.shortList.length}</div>

                    {contractionStats.stage === 'Insufficient data' && (
                      <div className="mt-2 text-xs text-amber-600">数据不足以可靠判断阶段；已计算平均值供参考。</div>
                    )}
                    {contractionStats.stage === 'Unclear' && (
                      <div className="mt-2 text-xs text-slate-500">指标模糊，建议继续记录更多宫缩以提高判定准确性。</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">恐龙宝宝诞生❤️欢迎来到这个世界！</h2>
                <p className="mt-1 text-xs text-slate-500">记录宝宝出生时的准确资料</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="birth-date" className="text-xs text-slate-500 mb-1 block">出生日期</label>
                    <input
                      id="birth-date"
                      type="date"
                      value={birthStats.birthDate}
                      onChange={(e) => setBirthStats({ ...birthStats, birthDate: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="birth-time" className="text-xs text-slate-500 mb-1 block">出生时间</label>
                    <input
                      id="birth-time"
                      type="time"
                      step="1"
                      value={birthStats.birthTime}
                      onChange={(e) => setBirthStats({ ...birthStats, birthTime: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="birth-weight" className="text-xs text-slate-500 mb-1 block">出生体重 (kg)</label>
                  <input
                    id="birth-weight"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    placeholder="例如：3.25"
                    value={birthStats.weight}
                    onChange={(e) => setBirthStats({ ...birthStats, weight: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="birth-height" className="text-xs text-slate-500 mb-1 block">出生身高 (cm，可选)</label>
                  <input
                    id="birth-height"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="例如：50"
                    value={birthStats.height}
                    onChange={(e) => setBirthStats({ ...birthStats, height: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="birth-main-condition" className="text-xs text-slate-500 mb-1 block">宝宝主要情况</label>
                  <select
                    id="birth-main-condition"
                    value={birthStats.mainCondition}
                    onChange={(e) => setBirthStats({ ...birthStats, mainCondition: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm bg-white"
                  >
                    <option value="">请选择宝宝主要情况</option>
                    <option value="我家宝贝当然是个完美宝贝">我家宝贝当然是个完美宝贝💯</option>
                    <option value="需要继续观察">需要继续观察🖊</option>
                    <option value="医生建议进NICU">医生建议进NICU🏥</option>
                    <option value="医生建议进保温箱">医生建议进保温箱🧊</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2">新生儿问题 (可多选)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      '黄疸或皮肤发黄',
                      '吸吮无力',
                      '体温异常',
                      '呼吸不顺：急促、喘息或暂停',
                      '脐带红肿或渗液',
                      '皮疹',
                      '体重偏低',
                      '抽搐或身体持续抖动',
                      '其他问题'
                    ].map((issue) => (
                      <label key={issue} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={birthStats.issues.includes(issue)}
                          onChange={(e) => setBirthStats({
                            ...birthStats,
                            issues: e.target.checked
                              ? [...birthStats.issues, issue]
                              : birthStats.issues.filter((selectedIssue) => selectedIssue !== issue),
                          })}
                          className="mt-0.5 accent-green-300"
                        />
                        <span>{issue}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="birth-condition" className="text-xs text-slate-500 mb-1 block">补充说明 (可选)</label>
                  <textarea
                    id="birth-condition"
                    rows="3"
                    placeholder="例如：哭声响亮，肤色正常"
                    value={birthStats.condition}
                    onChange={(e) => setBirthStats({ ...birthStats, condition: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300 text-sm resize-none"
                  />
                </div>

                <button
                  onClick={saveBirthStats}
                  className="w-full py-3 bg-green-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> 保存出生信息
                </button>
              </div>
            </div>
          </div>

        )}

        {activeTab === 'feeding' && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-2">喂奶记录</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'breast_left', label: '亲喂 (左)' },
                { id: 'breast_right', label: '亲喂 (右)' },
                { id: 'pump_bottle', label: '母乳瓶喂' },
                { id: 'formula_bottle', label: '配方奶/水奶' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFeedType(item.id)}
                  className={`p-3 text-sm rounded-xl border text-center transition-all ${
                    feedType === item.id
                      ? 'border-green-300 bg-green-50 text-green-300 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {(feedType === 'formula_bottle' || feedType === 'pump_bottle') && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">喂奶量 (ml)</label>

                <input
                  id="steps-range"
                  type="range"
                  min="0"
                  max="150"
                  value={feedAmount}
                  onChange={(e) => setFeedAmount(e.target.value)}
                  step="10"
                  className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer"
                />

                <div className="flex justify-between px-2.5 mt-2 text-xs">
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                </div>
                <div className="flex justify-between px-2.5 mt-2 text-xs">
                  <span>0</span>
                  <span>30</span>
                  <span>60</span>
                  <span>90</span>
                  <span>120</span>
                  <span>150</span>
                </div>
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <input
                    type="text"
                    value={feedAmount || '0'}
                    className="w-12 p-2 border border-slate-200 rounded-xl bg-slate-20 text-center text-xs"
                  />
                  <span className="text-slate-300">毫升</span>
                </div>
              </div>
            )}

            <button
              onClick={addFeedingLog}
              className="w-full py-3 bg-green-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Plus size={18} /> 保存喂奶记录
            </button>
          </div>
        )}

        {activeTab === 'diaper' && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-2">换尿裤/排便记录</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pee', label: '💧 小便' },
                { id: 'poo', label: '💩 大便' },
                { id: 'both', label: '✨ 混合' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDiaperType(item.id)}
                  className={`p-3 text-sm rounded-xl border text-center transition-all ${
                    diaperType === item.id
                      ? 'border-green-300 bg-green-50 text-green-300 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">备注 (颜色/形状/异常情况)</label>
              <input
                type="text"
                placeholder="例如：黄色糊状"
                value={diaperNote}
                onChange={(e) => setDiaperNote(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-green-300"
              />
            </div>

            <button
              onClick={addDiaperLog}
              className="w-full py-3 bg-green-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Plus size={18} /> 保存排便记录
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800 mb-2">历史记录 ({logs.length})</h2>
            {logs.length === 0 ? (
              <p className="text-center text-slate-400 py-8">暂无记录</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-slate-800 text-sm">
                      {log.type === 'contraction' && `⚡ 宫缩持续 ${log.duration} 秒${log.interval !== undefined ? `，距上次结束 ${log.interval} 分钟` : ''}`}
                      {log.type === 'feeding' && `🍼 ${log.detail}`}
                      {log.type === 'diaper' && `🪰 ${log.detail}`}
                      {log.type === 'alert' && `🔔 ${log.detail}`}
                      {log.type === 'birth' && `👶 出生记录：${log.birthDate} ${log.birthTime}，体重 ${log.weight} kg${log.height ? `，身高 ${log.height} cm` : ''}`}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{log.timestamp}</div>
                    {log.type === 'birth' && log.mainCondition && (
                      <div className="text-xs text-slate-500 mt-1">主要状况：{log.mainCondition}</div>
                    )}
                    {log.type === 'birth' && log.issues?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">新生儿问题：{log.issues.join('、')}</div>
                    )}
                    {log.type === 'birth' && log.condition && (
                      <div className="text-xs text-slate-500 mt-1">宝宝状况：{log.condition}</div>
                    )}
                  </div>
                  <button onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-rose-500 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 flex justify-around p-2">
        {[
          { id: 'contraction', label: '宫缩', icon: Timer },
          { id: 'feeding', label: '喂奶', icon: Milk },
          { id: 'diaper', label: '排泄', icon: Toilet },
          { id: 'sleep', label: '睡眠', icon: Moon },
          { id: 'history', label: '历史', icon: History },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-lg ${
                isActive ? 'text-green-300 font-bold' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {alertMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-title"
            aria-describedby="alert-message"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-300">
                <Bell size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 id="alert-title" className="text-lg font-bold text-slate-800">温馨提示</h2>
                <p id="alert-message" className="mt-2 text-sm leading-6 text-slate-600">{alertMessage}</p>
              </div>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => setAlertMessage(null)}
              className="mt-6 w-full rounded-xl bg-green-300 py-3 font-bold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}