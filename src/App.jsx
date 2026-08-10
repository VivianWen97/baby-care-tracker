import React, { useState, useEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { Timer, Baby, Heart, History, Trash2, Play, Square, Plus } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('contraction');
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('care_logs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('care_logs', JSON.stringify(logs));
  }, [logs]);

  // Contraction Timer
  const [isTiming, setIsTiming] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const chartRef = useRef(null);

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
      const newLog = {
        id: Date.now(),
        type: 'contraction',
        timestamp: startedAt.toLocaleString('en-US', {timeZone: 'America/New_York'}),
        startTime: startedAt.toISOString(),
        endTime: endedAt.toISOString(),
        duration: elapsed,
      };
      setLogs([newLog, ...logs]);
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
          show: false,
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
        max: 10,
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

  // Feeding Tracker
  const [feedType, setFeedType] = useState('breast_left');
  const [feedAmount, setFeedAmount] = useState('');

  const addFeedingLog = () => {
    if (feedType === 'bottle' && !feedAmount) return alert('请输入喂奶毫升数');
    const newLog = {
      id: Date.now(),
      type: 'feeding',
      detail: feedType === 'bottle' ? `瓶喂 ${feedAmount} ml` : `亲喂 (${feedType === 'breast_left' ? '左侧' : '右侧'})`,
      timestamp: new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}),
    };
    setLogs([newLog, ...logs]);
    setFeedAmount('');
    alert('已记录喂奶！');
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
    setLogs([newLog, ...logs]);
    setDiaperNote('');
    alert('已记录换尿裤！');
  };

  const deleteLog = (id) => {
    setLogs(logs.filter((log) => log.id !== id));
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-green-300 text-white p-4 text-center font-bold text-lg shadow-md">
        🦖小恐龙破壳日记录&新生护理助手🦖
      </header>

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
                    <p className="text-slate-800 text-xl font-semibold">近7天</p>
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
                      {log.type === 'contraction' && `⚡ 宫缩持续 ${log.duration} 秒`}
                      {log.type === 'feeding' && `🍼 ${log.detail}`}
                      {log.type === 'diaper' && `🪰 ${log.detail}`}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{log.timestamp}</div>
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
          { id: 'feeding', label: '喂奶', icon: Baby },
          { id: 'diaper', label: '排便', icon: Heart },
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
    </div>
  );
}