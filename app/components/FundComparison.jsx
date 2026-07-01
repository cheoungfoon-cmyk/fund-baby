'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, RadarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent, RadarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { analyzeFund, calcCorrelation, calcReturn, calcVolatility, calcMaxDrawdown, calcSharpe, calcMA } from '../lib/localAnalysis';

echarts.use([LineChart, BarChart, RadarChart, TooltipComponent, GridComponent, LegendComponent, RadarComponent, CanvasRenderer]);

/**
 * 基金对比组件
 * 选择多只基金进行并排对比
 */
export default function FundComparison({ funds, fundTrends }) {
  const [selected, setSelected] = useState([]);
  const perfChartRef = useRef(null);
  const radarChartRef = useRef(null);
  const perfInstance = useRef(null);
  const radarInstance = useRef(null);

  // 可对比的基金（有趋势数据的）
  const comparableFunds = useMemo(() => {
    return funds.filter(f => fundTrends[f.code]?.length > 10);
  }, [funds, fundTrends]);

  const handleToggle = (code) => {
    setSelected(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 5) return prev; // 最多选5只
      return [...prev, code];
    });
  };

  const selectAll = () => {
    setSelected(comparableFunds.slice(0, 5).map(f => f.code));
  };

  const clearAll = () => setSelected([]);

  // 选中的基金分析结果
  const analysisResults = useMemo(() => {
    return selected.map(code => {
      const fund = funds.find(f => f.code === code);
      const trend = fundTrends[code];
      if (!trend) return null;
      return {
        fund,
        trend,
        analysis: analyzeFund(trend, { fund }),
      };
    }).filter(Boolean);
  }, [selected, funds, fundTrends]);

  // 相关性矩阵
  const corrMatrix = useMemo(() => {
    const matrix = {};
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const corr = calcCorrelation(fundTrends[selected[i]], fundTrends[selected[j]]);
        matrix[`${selected[i]}-${selected[j]}`] = corr;
        matrix[`${selected[j]}-${selected[i]}`] = corr;
      }
      matrix[`${selected[i]}-${selected[i]}`] = 1;
    }
    return matrix;
  }, [selected, fundTrends]);

  // 渲染对比绩效图
  useEffect(() => {
    if (analysisResults.length < 2 || !perfChartRef.current) return;
    if (perfInstance.current) perfInstance.current.dispose();
    const chart = echarts.init(perfChartRef.current);
    perfInstance.current = chart;

    const series = analysisResults.map((r, idx) => {
      if (!Array.isArray(r.trend) || r.trend.length < 2) return null;
      // 归一化到起始点为 100
      const firstVal = r.trend[0].y;
      const data = r.trend.map(d => ({
        value: [(d.x * 1000 || d.x), ((d.y / firstVal) * 100)],
      }));
      return {
        name: r.fund.name || r.fund.code,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5 },
        data,
      };
    }).filter(Boolean);

    if (series.length < 2) return;

    chart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        formatter(params) {
          const p = params && params[0];
          if (!p) return '';
          const d = new Date(p.value[0]);
          const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          let html = `<strong>${date}</strong><br/>`;
          params.forEach(pp => {
            html += `${pp.marker} ${pp.seriesName}: ${pp.value[1].toFixed(2)}<br/>`;
          });
          return html;
        },
      },
      legend: {
        data: series.map(s => s.name),
        textStyle: { color: '#999', fontSize: 11 },
        top: 0,
        type: 'scroll',
      },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'time',
        axisLabel: { color: '#666', fontSize: 10, formatter: (v) => {
          const d = new Date(v);
          return `${d.getMonth() + 1}/${d.getDate()}`;
        }},
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '归一化收益',
        nameTextStyle: { color: '#999', fontSize: 10 },
        axisLabel: { color: '#666', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series,
    });

    return () => { if (perfInstance.current) { perfInstance.current.dispose(); perfInstance.current = null; } };
  }, [analysisResults]);

  // 渲染雷达图
  useEffect(() => {
    if (analysisResults.length < 1 || !radarChartRef.current) return;
    if (radarInstance.current) radarInstance.current.dispose();
    const chart = echarts.init(radarChartRef.current);
    radarInstance.current = chart;

    const indicators = [
      { name: '1月收益', max: 20 },
      { name: '3月收益', max: 30 },
      { name: '抗回撤', max: 100 },
      { name: '波动率(低)', max: 30 },
      { name: '夏普比率', max: 5 },
      { name: '趋势强度', max: 100 },
    ];

    const series = analysisResults.map(r => {
      const ret1m = r.analysis.summary.returns['1月'] || 0;
      const ret3m = r.analysis.summary.returns['3月'] || 0;
      const dd = r.analysis.risk.maxDrawdown || 0;
      const vol = r.analysis.risk.volatility || 0;
      const sharpe = r.analysis.summary.sharpe || 0;
      // 用回撤的反向作为抗回撤指标
      const antiDD = Math.max(0, 100 - dd * 2);
      const trendScore = r.analysis.technical.trendSignal === '多头趋势' ? 90
        : r.analysis.technical.trendSignal === '偏多头' ? 70
        : r.analysis.technical.trendSignal === '震荡整理' ? 50
        : r.analysis.technical.trendSignal === '偏空头' ? 30 : 10;
      return {
        value: [
          Math.max(0, Math.min(20, ret1m)),
          Math.max(0, Math.min(30, ret3m)),
          Math.max(0, Math.min(100, antiDD)),
          Math.max(0, Math.min(30, vol)),
          Math.max(0, Math.min(5, sharpe)),
          trendScore,
        ],
        name: r.fund.name,
      };
    });

    chart.setOption({
      animation: false,
      radar: {
        indicator,
        center: ['50%', '55%'],
        radius: '65%',
        axisName: { color: '#999', fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(34,211,238,0.02)', 'rgba(34,211,238,0.05)'] } },
      },
      series: [{
        type: 'radar',
        data: series,
        lineStyle: { width: 1 },
        areaStyle: { opacity: 0.1 },
      }],
    });

    return () => { if (radarInstance.current) { radarInstance.current.dispose(); radarInstance.current = null; } };
  }, [analysisResults]);

  const corrColor = (val) => {
    if (val == null) return '#666';
    const abs = Math.abs(val);
    if (abs > 0.8) return '#f87171';
    if (abs > 0.5) return '#fb923c';
    if (abs > 0.3) return '#fbbf24';
    return '#34d399';
  };

  if (comparableFunds.length === 0) {
    return (
      <div className="native-analysis-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="muted">暂无足够基金数据用于对比（需要至少2只基金且有趋势数据）</div>
      </div>
    );
  }

  return (
    <div className="comparison-workspace">
      <div className="native-analysis-card">
        <div className="native-analysis-card-head">
          <div>
            <span className="native-analysis-kicker">基金对比</span>
            <h3>选择基金进行并排对比（最多5只）</h3>
          </div>
          <div className="analysis-actions" style={{ gap: 8 }}>
            <button className="button secondary analysis-button small" onClick={selectAll}>全选</button>
            <button className="button secondary analysis-button small" onClick={clearAll}>清除</button>
          </div>
        </div>
        <div className="comparison-fund-selector" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {comparableFunds.map(f => {
            const isOn = selected.includes(f.code);
            return (
              <button
                key={f.code}
                className={`chip ${isOn ? 'active' : ''}`}
                onClick={() => handleToggle(f.code)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  border: isOn ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                  background: isOn ? 'rgba(34,211,238,0.1)' : 'transparent',
                }}
              >
                <span>#{f.code}</span>
                <span style={{ marginLeft: 4 }}>{f.name?.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {analysisResults.length >= 2 && (
        <>
          {/* 相关性矩阵 */}
          <div className="native-analysis-card">
            <div className="native-analysis-card-head">
              <div>
                <span className="native-analysis-kicker">相关性矩阵</span>
                <h3>基金之间的相关性分析（值越接近1表示走势越相似）</h3>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="comparison-corr-table" style={{
                width: '100%', borderCollapse: 'collapse', fontSize: '13px',
              }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#999' }}></th>
                    {selected.map(code => {
                      const f = funds.find(ff => ff.code === code);
                      return (
                        <th key={code} style={{ padding: '8px', textAlign: 'center', color: '#999', fontWeight: 500 }}>
                          {f?.name?.slice(0, 6) || code}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {selected.map(codeA => {
                    const fA = funds.find(ff => ff.code === codeA);
                    return (
                      <tr key={codeA}>
                        <td style={{ padding: '8px', color: '#ccc', fontWeight: 500 }}>
                          {fA?.name?.slice(0, 6) || codeA}
                        </td>
                        {selected.map(codeB => {
                          const corr = corrMatrix[`${codeA}-${codeB}`];
                          const displayVal = corr != null ? corr.toFixed(2) : '--';
                          return (
                            <td key={codeB} style={{
                              padding: '8px', textAlign: 'center',
                              color: codeA === codeB ? '#666' : corrColor(corr),
                              fontWeight: corr != null && Math.abs(corr) > 0.5 ? 600 : 400,
                            }}>
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 绩效对比图 */}
          <div className="native-analysis-card">
            <div className="native-analysis-card-head">
              <div>
                <span className="native-analysis-kicker">绩效对比</span>
                <h3>归一化净值走势对比（起始 = 100）</h3>
              </div>
            </div>
            <div ref={perfChartRef} style={{ height: 280, marginTop: 12 }} />
          </div>

          {/* 雷达图 */}
          <div className="native-analysis-card">
            <div className="native-analysis-card-head">
              <div>
                <span className="native-analysis-kicker">综合画像</span>
                <h3>多维度对比（收益、抗回撤、波动率等）</h3>
              </div>
            </div>
            <div ref={radarChartRef} style={{ height: 300, marginTop: 12 }} />
          </div>

          {/* 指标对比表 */}
          <div className="native-analysis-card">
            <div className="native-analysis-card-head">
              <div>
                <span className="native-analysis-kicker">指标对比</span>
                <h3>核心指标一览</h3>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="comparison-metrics-table" style={{
                width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: 8,
              }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#999', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      指标
                    </th>
                    {analysisResults.map(r => (
                      <th key={r.fund.code} style={{
                        padding: '8px 12px', textAlign: 'center', color: '#ccc', fontWeight: 500,
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        {r.fund.name?.slice(0, 8) || r.fund.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: '近1周', key: '1周', fmt: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
                    { label: '近1月', key: '1月', fmt: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
                    { label: '近3月', key: '3月', fmt: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
                    { label: '近6月', key: '6月', fmt: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
                    { label: '近1年', key: '1年', fmt: (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
                    { label: '波动率(年化)', key: 'vol', get: (r) => r.analysis.summary.volatility, fmt: (v) => v != null ? `${v}%` : '--' },
                    { label: '最大回撤', key: 'dd', get: (r) => r.analysis.summary.maxDrawdown, fmt: (v) => v != null ? `${v}%` : '--' },
                    { label: '夏普比率', key: 'sharpe', get: (r) => r.analysis.summary.sharpe, fmt: (v) => v != null ? v : '--' },
                    { label: 'RSI', key: 'rsi', get: (r) => r.analysis.technical.rsi, fmt: (v) => v ?? '--' },
                    { label: '趋势判断', key: 'trend', get: (r) => r.analysis.technical.trendSignal, fmt: (v) => v || '--' },
                    { label: '风险等级', key: 'risk', get: (r) => r.analysis.risk.level, fmt: (v) => v || '--' },
                    { label: '操作建议', key: 'action', get: (r) => r.analysis.finalDecision.action_label, fmt: (v) => v || '--' },
                  ].map(row => {
                    const values = analysisResults.map(r => row.get ? row.get(r) : r.analysis.summary.returns[row.key]);
                    return (
                      <tr key={row.label}>
                        <td style={{ padding: '8px 12px', color: '#999', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {row.label}
                        </td>
                        {values.map((v, i) => (
                          <td key={i} style={{
                            padding: '8px 12px', textAlign: 'center', fontWeight: 500,
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                          }}>
                            {row.fmt(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selected.length === 1 && (
        <div className="native-analysis-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div className="muted">请至少选择两只基金进行对比</div>
        </div>
      )}

      {analysisResults.length === 0 && selected.length > 0 && analysisResults.length < 2 && selected.length < 2 && (
        <div className="native-analysis-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div className="muted">请再选择至少一只基金进行对比</div>
        </div>
      )}
    </div>
  );
}
