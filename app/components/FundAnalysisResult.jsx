'use client';

// ─── Helper components ──────────────────────────────────────────────
function AnalysisPill({ children, tone = 'neutral' }) {
  return <span className={`native-analysis-pill tone-${tone}`}>{children}</span>;
}

function AnalysisMetric({ label, value, tone }) {
  return (
    <div className="native-analysis-metric">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : ''}>{value ?? '--'}</strong>
    </div>
  );
}

function getDecisionTone(action) {
  if (['buy', 'small_buy', 'add'].includes(action)) return 'up';
  if (['sell', 'reduce', 'avoid'].includes(action)) return 'down';
  if (['wait', 'hold'].includes(action)) return 'warn';
  return 'neutral';
}

function fmtPct(v) {
  if (v == null || v === '--') return '--';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '--';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmt(v, decimals = 4) {
  if (v == null || v === '--') return '--';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '--';
  return n.toFixed(decimals);
}

function directionTone(v) {
  if (!v) return '';
  const s = String(v);
  if (s.includes('涨') || s.includes('升') || s.includes('积极') || s.includes('强')) return 'up';
  if (s.includes('跌') || s.includes('谨慎') || s.includes('弱') || s.includes('风险')) return 'down';
  return '';
}

// ─── Sections ───────────────────────────────────────────────────────

/** 1. 最终结论 */
function HeroDecision({ finalDecision, analysis, fund }) {
  const tone = getDecisionTone(finalDecision?.action || analysis?.conclusion_action);

  // Get analysis text from agent
  const agentConclusion = analysis?.conclusion;
  const agentSummary = analysis?.summary_7d || analysis?.summary_30d || analysis?.summary_90d;

  return (
    <div className="native-analysis-card hero-decision">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">最终参考结论</span>
          <h2>{finalDecision?.headline || fund?.name || '分析结果'}</h2>
        </div>
        <AnalysisPill tone={tone}>
          {finalDecision?.action_label || '观察'}
        </AnalysisPill>
      </div>

      <p className="native-analysis-summary">
        {finalDecision?.summary || analysis?.note || '本结果仅供个人研究参考，不构成投资建议。'}
      </p>

      {/* Confidence + risk + up probabilities */}
      <div className="native-analysis-metrics-grid compact">
        <AnalysisMetric label="置信度" value={finalDecision?.confidence || analysis?.confidence || '--'} tone={tone} />
        <AnalysisMetric label="风险分" value={finalDecision?.risk_score ?? '--'} />
        <AnalysisMetric label="7天上涨概率" value={finalDecision?.up_probability_7d != null ? `${finalDecision.up_probability_7d}%` : '--'} />
        <AnalysisMetric label="30天上涨概率" value={finalDecision?.up_probability_30d != null ? `${finalDecision.up_probability_30d}%` : '--'} />
      </div>

      {/* Why / reasons */}
      {Array.isArray(finalDecision?.why) && finalDecision.why.length > 0 && (
        <ul className="native-analysis-list" style={{ marginTop: 8 }}>
          {finalDecision.why.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}

      {/* Watch points */}
      {Array.isArray(finalDecision?.watch) && finalDecision.watch.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>需要关注</span>
          <ul className="native-analysis-list">
            {finalDecision.watch.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {Array.isArray(finalDecision?.warning) && finalDecision.warning.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: '13px' }}>
          <strong style={{ color: '#f87171' }}>⚠ 风险提示</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: '#fca5a5' }}>
            {finalDecision.warning.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Agent analysis text (from LLM) */}
      {agentConclusion && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(34,211,238,0.05)', borderRadius: 8, border: '1px solid rgba(34,211,238,0.1)' }}>
          <div className="muted" style={{ fontSize: '12px', marginBottom: 6 }}>AI 分析总结</div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>
            <AnalysisPill tone={getDecisionTone(agentConclusion)}>{agentConclusion}</AnalysisPill>
          </div>
          {agentSummary && <p style={{ fontSize: '13px', marginTop: 6, lineHeight: 1.5 }}>{agentSummary}</p>}
        </div>
      )}
    </div>
  );
}

/** 2. 基金档案 — 基金经理、规模、费率、评级等 */
function FundProfileSection({ fund, fundProfile, metrics }) {
  const fp = fundProfile || {};
  const items = [];

  if (fp.fund_manager) items.push({ label: '基金经理', value: fp.fund_manager });
  if (fp.inception_date) items.push({ label: '成立日期', value: fp.inception_date });
  if (fp.fund_size) items.push({ label: '基金规模', value: fp.fund_size });
  if (fp.tracking_index) items.push({ label: '跟踪指数', value: fp.tracking_index });
  if (fp.management_fee) items.push({ label: '管理费率', value: fp.management_fee });
  if (fp.custody_fee) items.push({ label: '托管费率', value: fp.custody_fee });
  if (fp.sales_service_fee) items.push({ label: '销售服务费', value: fp.sales_service_fee });
  if (fp.risk_level) items.push({ label: '风险等级(官方)', value: fp.risk_level, tone: directionTone(fp.risk_level) });
  if (fp.return_1y) items.push({ label: '近1年收益(官方)', value: fp.return_1y, tone: (() => { const n = parseFloat(fp.return_1y); return n > 0 ? 'up' : n < 0 ? 'down' : ''; })() });
  if (fp.peer_ranking) items.push({ label: '同类排名', value: fp.peer_ranking });
  if (fp.purchase_status) items.push({ label: '申购状态', value: fp.purchase_status });
  if (fp.redeem_status) items.push({ label: '赎回状态', value: fp.redeem_status });
  if (fp.data_quality) items.push({ label: '数据质量', value: fp.data_quality });

  if (items.length === 0 && !fund) return null;

  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">基金档案</span>
          <h3>{fund?.name || '未知基金'}</h3>
        </div>
        <span className="fund-code-badge">#{fund?.code || '--'}</span>
      </div>
      <div className="native-analysis-tags">
        <AnalysisPill>{fund?.type || fp?.fund_type || '类型未知'}</AnalysisPill>
        <AnalysisPill>{fund?.company || fp?.fund_company || '公司未知'}</AnalysisPill>
        {metrics?.current_estimate?.estimate_time && <AnalysisPill>估值 {metrics.current_estimate.estimate_time}</AnalysisPill>}
        {metrics?.data_days && <AnalysisPill>{metrics.data_days}天数据</AnalysisPill>}
      </div>
      {items.length > 0 && (
        <div className="native-analysis-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, fontSize: '13px', marginTop: 8 }}>
          {items.map((item, i) => (
            <div key={i}>
              <span className="muted" style={{ display: 'block', fontSize: '11px', marginBottom: 2 }}>{item.label}</span>
              <span className={item.tone ? `tone-${item.tone}` : ''} style={{ fontWeight: 500 }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 3. 完整指标仪表板 */
function MetricsDashboard({ metrics, fund }) {
  if (!metrics || metrics.error) return null;

  const m = metrics;

  // Helper to render a metrics group
  const MetricGroup = ({ title, rows }) => (
    <div style={{ marginTop: 12 }}>
      <span className="muted" style={{ fontSize: '12px', marginBottom: 6, display: 'block' }}>{title}</span>
      <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
        {rows.map((r, i) => {
          if (r.value == null) return null;
          return <AnalysisMetric key={i} label={r.label} value={r.value} tone={r.tone || ''} />;
        })}
      </div>
    </div>
  );

  const groupCurrent = [
    { label: '最新净值', value: fmt(m.latest_nav) },
    { label: '日涨跌', value: fmtPct(m.return_1trading ?? m.daily_return), tone: m.return_1trading > 0 ? 'up' : m.return_1trading < 0 ? 'down' : '' },
  ];
  if (m.current_estimate?.estimated_change_pct != null) {
    groupCurrent.push({
      label: `估算(${m.current_estimate.estimate_time || ''})`,
      value: fmtPct(m.current_estimate.estimated_change_pct),
      tone: m.current_estimate.estimated_change_pct > 0 ? 'up' : m.current_estimate.estimated_change_pct < 0 ? 'down' : '',
    });
  }

  const groupCalendarReturns = [
    { label: '近7天', value: fmtPct(m.return_7d_calendar ?? m.return_7d), tone: (m.return_7d_calendar || m.return_7d) > 0 ? 'up' : (m.return_7d_calendar || m.return_7d) < 0 ? 'down' : '' },
    { label: '近30天', value: fmtPct(m.return_30d_calendar ?? m.return_30d), tone: (m.return_30d_calendar || m.return_30d) > 0 ? 'up' : (m.return_30d_calendar || m.return_30d) < 0 ? 'down' : '' },
    { label: '近60天', value: fmtPct(m.return_60d), tone: m.return_60d > 0 ? 'up' : m.return_60d < 0 ? 'down' : '' },
    { label: '近90天', value: fmtPct(m.return_90d_calendar ?? m.return_90d), tone: (m.return_90d_calendar || m.return_90d) > 0 ? 'up' : (m.return_90d_calendar || m.return_90d) < 0 ? 'down' : '' },
  ];

  const groupTradingReturns = [
    { label: '近1日', value: fmtPct(m.return_1trading), tone: m.return_1trading > 0 ? 'up' : m.return_1trading < 0 ? 'down' : '' },
    { label: '近5日', value: fmtPct(m.return_5trading), tone: m.return_5trading > 0 ? 'up' : m.return_5trading < 0 ? 'down' : '' },
    { label: '近10日', value: fmtPct(m.return_10trading), tone: m.return_10trading > 0 ? 'up' : m.return_10trading < 0 ? 'down' : '' },
    { label: '近20日', value: fmtPct(m.return_20trading), tone: m.return_20trading > 0 ? 'up' : m.return_20trading < 0 ? 'down' : '' },
    { label: '近60日', value: fmtPct(m.return_60trading), tone: m.return_60trading > 0 ? 'up' : m.return_60trading < 0 ? 'down' : '' },
  ];

  const groupDrawdown = [
    { label: '近7天回撤', value: fmtPct(m.max_drawdown_7d_calendar ?? m.max_drawdown_7d), tone: 'down' },
    { label: '近30天回撤', value: fmtPct(m.max_drawdown_30d_calendar ?? m.max_drawdown_30d), tone: 'down' },
    { label: '近60天回撤', value: fmtPct(m.max_drawdown_60d), tone: 'down' },
    { label: '近90天回撤', value: fmtPct(m.max_drawdown_90d_calendar ?? m.max_drawdown_90d), tone: 'down' },
  ];

  // Enhanced risk metrics with all native fields from fund-analysis-agent
  const groupRisk = [
    { label: '波动率30天', value: m.volatility_30d != null ? `${fmt(m.volatility_30d, 1)}%` : null },
    { label: '波动率60天', value: m.volatility_60d != null ? `${fmt(m.volatility_60d, 1)}%` : null },
    { label: '夏普30天', value: m.sharpe_30d != null ? fmt(m.sharpe_30d, 2) : null },
    { label: '夏普60天', value: m.sharpe_60d != null ? fmt(m.sharpe_60d, 2) : null },
    { label: 'Calmar 60天', value: m.calmar_60d != null ? fmt(m.calmar_60d, 2) : null },
    { label: 'Calmar 90天', value: m.calmar_90d != null ? fmt(m.calmar_90d, 2) : null },
    { label: '跌幅波动率30', value: m.downside_volatility_30d != null ? `${fmt(m.downside_volatility_30d, 1)}%` : null },
    { label: '上行胜率30天', value: m.win_rate_30d != null ? `${fmt(m.win_rate_30d, 1)}%` : null },
    { label: 'EWMA波动20天', value: m.ewma_volatility_20d != null ? `${fmt(m.ewma_volatility_20d, 1)}%` : null },
    { label: '波动率百分位30天', value: m.volatility_percentile_30d != null ? `${fmt(m.volatility_percentile_30d, 1)}%` : null },
    { label: '波动率状态30天', value: m.volatility_regime_30d || null },
    { label: 'Calmar 90天', value: m.calmar_90d != null ? fmt(m.calmar_90d, 2) : null },
    { label: '累积收益30天', value: m.return_30d_acc_nav != null ? fmtPct(m.return_30d_acc_nav) : null },
    { label: '累积收益90天', value: m.return_90d_acc_nav != null ? fmtPct(m.return_90d_acc_nav) : null },
  ];

  const groupMA = [
    { label: 'MA5', value: m.ma_5 != null ? fmt(m.ma_5) : null },
    { label: 'MA10', value: m.ma_10 != null ? fmt(m.ma_10) : null },
    { label: 'MA20', value: m.ma_20 != null ? fmt(m.ma_20) : null },
    { label: 'MA60', value: m.ma_60 != null ? fmt(m.ma_60) : null },
    { label: '均线趋势', value: m.trend || null, tone: directionTone(m.trend) },
  ];

  const groupRSI = [
    { label: 'RSI 7', value: m.rsi_7d != null ? fmt(m.rsi_7d, 1) : null },
    { label: 'RSI 14', value: m.rsi_14d != null ? fmt(m.rsi_14d, 1) : null },
    { label: 'RSI 21', value: m.rsi_21d != null ? fmt(m.rsi_21d, 1) : null },
  ];

  const groupPosition = [
    { label: '近7天位置', value: m.position_in_7d_range != null ? `${fmt(m.position_in_7d_range, 1)}%` : null },
    { label: '近30天位置', value: m.position_in_30d_range != null ? `${fmt(m.position_in_30d_range, 1)}%` : null },
    { label: '近60天位置', value: m.position_in_60d_range != null ? `${fmt(m.position_in_60d_range, 1)}%` : null },
    { label: '30天反弹幅度', value: m.rebound_from_30d_low != null ? fmtPct(m.rebound_from_30d_low) : null },
    { label: '30天回落幅度', value: m.pullback_from_30d_high != null ? fmtPct(m.pullback_from_30d_high) : null, tone: 'down' },
  ];

  const groupStats = [];
  const cd = m.consecutive_days;
  if (cd && cd.days) {
    groupStats.push({ label: `连${cd.direction === 'up' ? '涨' : '跌'}`, value: `${cd.days}天`, tone: cd.direction === 'up' ? 'up' : 'down' });
  }
  const ds = m.daily_stats;
  if (ds) {
    if (ds.mean != null) groupStats.push({ label: '日均涨跌', value: fmtPct(ds.mean) });
    if (ds.max != null) groupStats.push({ label: '最大日涨', value: fmtPct(ds.max), tone: 'up' });
    if (ds.min != null) groupStats.push({ label: '最大日跌', value: fmtPct(ds.min), tone: 'down' });
    if (ds.positive_days != null) groupStats.push({ label: '上涨天数', value: ds.positive_days });
    if (ds.negative_days != null) groupStats.push({ label: '下跌天数', value: ds.negative_days });
  }
  if (m.momentum_acceleration_5d != null) {
    groupStats.push({ label: '5日动量', value: fmt(m.momentum_acceleration_5d, 3), tone: m.momentum_acceleration_5d > 0 ? 'up' : m.momentum_acceleration_5d < 0 ? 'down' : '' });
  }

  const period7d = m.period_7d_calendar;
  const period30d = m.period_30d_calendar;
  const period90d = m.period_90d_calendar;
  const hasPeriodDetails = period7d || period30d || period90d;

  const hasAny = groupCurrent.concat(groupCalendarReturns, groupDrawdown, groupRisk, groupMA, groupRSI).some(r => r.value != null);

  if (!hasAny) return null;

  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">指标仪表板</span>
          <h3>多维度技术指标</h3>
        </div>
      </div>

      {/* Current values */}
      <div className="native-analysis-metrics-grid compact" style={{ marginBottom: 8 }}>
        {groupCurrent.map((r, i) => r.value != null ? <AnalysisMetric key={i} label={r.label} value={r.value} tone={r.tone} /> : null)}
      </div>

      {/* Period returns */}
      {groupCalendarReturns.some(r => r.value != null) && (
        <MetricGroup title="阶段收益（自然日口径）" rows={groupCalendarReturns} />
      )}
      {groupTradingReturns.some(r => r.value != null) && (
        <MetricGroup title="阶段收益（交易日口径）" rows={groupTradingReturns} />
      )}
      {groupDrawdown.some(r => r.value != null) && (
        <MetricGroup title="阶段最大回撤" rows={groupDrawdown} />
      )}
      {groupRisk.some(r => r.value != null) && (
        <MetricGroup title="风险指标" rows={groupRisk} />
      )}
      {groupMA.some(r => r.value != null) && (
        <MetricGroup title="均线 & 趋势" rows={groupMA} />
      )}
      {groupRSI.some(r => r.value != null) && (
        <MetricGroup title="RSI 相对强弱" rows={groupRSI} />
      )}
      {groupPosition.some(r => r.value != null) && (
        <MetricGroup title="位置 & 动量" rows={groupPosition} />
      )}
      {groupStats.length > 0 && (
        <MetricGroup title="统计特征" rows={groupStats} />
      )}
      {hasPeriodDetails && (
        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ fontSize: '12px', cursor: 'pointer' }}>📅 查看各区间详细净值数据</summary>
          <div style={{ marginTop: 8 }}>
            {period7d && <PeriodCard title="近7天详情" p={period7d} />}
            {period30d && <PeriodCard title="近30天详情" p={period30d} />}
            {period90d && <PeriodCard title="近90天详情" p={period90d} />}
          </div>
        </details>
      )}
    </div>
  );
}

/** 4. 风险分解 — 多维度评分条 */
function RiskBreakdown({ risk }) {
  if (!risk || risk.risk_score == null) return null;

  // Support both flat score fields and nested dimensions from demo response
  const dimData = risk.dimensions || risk;
  const dims = [
    { label: '趋势', key: 'trend_score', value: dimData.trend_score ?? risk.trend_score },
    { label: '回撤', key: 'drawdown_score', value: dimData.drawdown_score ?? risk.drawdown_score },
    { label: '波动率', key: 'volatility_score', value: dimData.volatility_score ?? risk.volatility_score },
    { label: '位置', key: 'position_score', value: dimData.position_score ?? risk.position_score },
    { label: '宏观', key: 'macro_score', value: dimData.macro_score ?? risk.macro_score },
  ];

  const hasDims = dims.some(d => d.value != null);
  const hasPersonal = risk.position_personal_score != null;

  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">风险分解</span>
          <h3>{risk.risk_level || '风险画像'} — {risk.risk_score ?? '--'} 分</h3>
        </div>
        <AnalysisPill tone={risk.risk_score > 70 ? 'down' : risk.risk_score > 45 ? 'warn' : 'up'}>
          {risk.risk_score ?? '--'} 分
        </AnalysisPill>
      </div>

      {/* Overall risk bar */}
      <div className="native-risk-bar" style={{ marginBottom: 12 }}>
        <span style={{ width: `${Math.max(0, Math.min(100, risk.risk_score || 0))}%` }} />
      </div>

      {/* Multi-dimension bars */}
      {hasDims && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dims.map(d => {
            if (d.value == null) return null;
            const w = Math.max(0, Math.min(100, d.value));
            return (
              <div key={d.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 2 }}>
                  <span className="muted">{d.label}</span>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{d.value.toFixed(0)}</span>
                </div>
                <div className="native-risk-bar" style={{ height: 6 }}>
                  <span style={{
                    width: `${w}%`,
                    height: 6,
                    background: d.value > 70 ? '#f87171' : d.value > 45 ? '#fbbf24' : '#34d399',
                    borderRadius: 3,
                    display: 'block',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Personal position score */}
      {hasPersonal && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', borderRadius: 8, fontSize: '13px' }}>
          <span className="muted">个人持仓风险: </span>
          <strong style={{ color: risk.position_personal_score > 70 ? '#f87171' : risk.position_personal_score > 45 ? '#fbbf24' : '#34d399' }}>
            {risk.position_personal_score.toFixed(0)} 分
          </strong>
        </div>
      )}

      {/* Reasons */}
      {Array.isArray(risk.reasons) && risk.reasons.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: '12px' }}>评分依据</span>
          <ul className="native-analysis-list">
            {risk.reasons.slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {Array.isArray(risk.warnings) && risk.warnings.length > 0 && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, fontSize: '12px', color: '#fca5a5' }}>
          <strong>⚠ </strong>
          {risk.warnings.slice(0, 3).join('；')}
        </div>
      )}
    </div>
  );
}

/** 5. 走势情景 — 1/3/7/30天概率判断 */
/** PeriodCard - 显示区间详情 */
function PeriodCard({ title, p }) {
  if (!p) return null;
  return (
    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6 }}>
      <span className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>{title}</span>
      <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 4, marginTop: 4 }}>
        {p.start_date && <span style={{ fontSize: '11px' }}>开始: {p.start_date}</span>}
        {p.end_date && <span style={{ fontSize: '11px' }}>结束: {p.end_date}</span>}
        {p.days != null && <span style={{ fontSize: '11px' }}>天数: {p.days}</span>}
        {p.start_nav != null && <span style={{ fontSize: '11px' }}>起始净值: {fmt(p.start_nav)}</span>}
        {p.end_nav != null && <span style={{ fontSize: '11px' }}>结束净值: {fmt(p.end_nav)}</span>}
      </div>
    </div>
  );
}

function ForecastBlock({ forecast }) {
  if (!forecast) return null;

  const periods = [
    { key: 'forecast_1d', label: '1天' },
    { key: 'forecast_3d', label: '3天' },
    { key: 'forecast_7d', label: '7天' },
    { key: 'forecast_30d', label: '30天' },
  ];

  const hasAny = periods.some(p => forecast[p.key]);
  if (!hasAny) return null;

  const validation = forecast.validation;

  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">走势情景判断</span>
          <h3>概率化情景分析</h3>
        </div>
        {validation?.sample_size > 0 && (
          <span className="muted" style={{ fontSize: '11px' }}>回测样本: {validation.sample_size}</span>
        )}
      </div>

      <div className="native-analysis-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {periods.map(p => {
          const f = forecast[p.key];
          if (!f) return null;
          const tone = directionTone(f.direction || f.rise_fall);
          return (
            <div key={p.key} style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: `1px solid ${tone === 'up' ? 'rgba(52,211,153,0.2)' : tone === 'down' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: '12px' }}>{p.label}</span>
                <span style={{
                  fontSize: '12px', fontWeight: 600,
                  color: tone === 'up' ? '#34d399' : tone === 'down' ? '#f87171' : '#999',
                }}>
                  {f.direction || f.rise_fall || '--'}
                </span>
              </div>
              {f.up_probability != null && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <div className="native-risk-bar" style={{ flex: 1, height: 6 }}>
                    <span style={{
                      width: `${f.up_probability}%`,
                      height: 6,
                      background: f.up_probability > 60 ? '#34d399' : f.up_probability > 40 ? '#fbbf24' : '#f87171',
                      borderRadius: 3,
                      display: 'block',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                    {f.up_probability}%
                  </span>
                </div>
              )}
              {/* Sideways / Down probability bars */}
              {(f.sideways_probability != null || f.down_probability != null) && (
                <div style={{ display: 'flex', gap: 4, fontSize: '10px', marginTop: 4 }}>
                  {f.up_probability != null && <span style={{ color: '#34d399' }}>涨{f.up_probability}%</span>}
                  {f.sideways_probability != null && <span style={{ color: '#fbbf24' }}>平{f.sideways_probability}%</span>}
                  {f.down_probability != null && <span style={{ color: '#f87171' }}>跌{f.down_probability}%</span>}
                </div>
              )}
              {/* Expected return range */}
              {f.expected_return_range?.low != null && f.expected_return_range?.high != null && (
                <div style={{ fontSize: '11px', color: '#999', marginTop: 2 }}>
                  <span>预期收益: {f.expected_return_range.low}% ~ {f.expected_return_range.high}%{f.expected_return_range.unit ? f.expected_return_range.unit : ''}</span>
                  {f.expected_return_range.note && <span style={{ marginLeft: 4, fontSize: '10px' }}>({f.expected_return_range.note})</span>}
                </div>
              )}
              {f.scenario_summary && (
                <p style={{ fontSize: '12px', lineHeight: 1.4, color: '#999', margin: 0 }}>
                  {f.scenario_summary}
                </p>
              )}
              {f.price_range?.low != null && f.price_range?.high != null && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
                  <span>区间: {f.price_range.low.toFixed(4)} ~ {f.price_range.high.toFixed(4)}</span>
                </div>
              )}
              {f.probability_quality && (
                <div style={{ fontSize: '10px', color: '#555', marginTop: 4 }}>
                  质量: {f.probability_quality} | {f.model_basis || 'rule'}
                </div>
              )}
              {/* Triggers */}
              {Array.isArray(f.up_triggers) && f.up_triggers.length > 0 && (
                <div style={{ fontSize: '11px', color: '#34d399', marginTop: 4 }}>
                  <strong>上行触发: </strong>{f.up_triggers.slice(0, 2).join('；')}
                </div>
              )}
              {Array.isArray(f.down_triggers) && f.down_triggers.length > 0 && (
                <div style={{ fontSize: '11px', color: '#f87171', marginTop: 2 }}>
                  <strong>下行触发: </strong>{f.down_triggers.slice(0, 2).join('；')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Uncertainties */}
      {periods.some(p => Array.isArray(forecast[p.key]?.main_uncertainties) && forecast[p.key].main_uncertainties.length > 0) && (
        <div style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: '12px' }}>不确定性因素</span>
          <ul className="native-analysis-list">
            {periods.map(p => {
              const f = forecast[p.key];
              if (!f?.main_uncertainties?.length) return null;
              return f.main_uncertainties.slice(0, 2).map((item, i) => <li key={`${p.key}-${i}`}>{item}</li>);
            }).filter(Boolean).flat()}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 6. 预测详情 — 上涨概率、置信度、验证 */
function PredictionDetail({ prediction }) {
  if (!prediction) return null;

  const periods = prediction.periods || {};
  const p7d = periods['7d'] || {};
  const p30d = periods['30d'] || {};
  const hasData = p7d.up_probability != null || p30d.up_probability != null;

  if (!hasData && !prediction.quality && !prediction.direction) return null;

  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">预测详情</span>
          <h3>概率预测与验证</h3>
        </div>
        <AnalysisPill>
          {prediction.quality || '--'} | {prediction.model_basis || '--'}
        </AnalysisPill>
      </div>

      <div className="native-analysis-grid two" style={{ gap: 8 }}>
        {/* 7 days */}
        {p7d.up_probability != null && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: '12px', marginBottom: 4 }}>7天预测</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>上涨概率 {p7d.up_probability}%</span>
              <AnalysisPill tone={getDecisionTone(p7d.predicted_direction)}>
                {p7d.predicted_direction === 'up' ? '偏涨' : p7d.predicted_direction === 'down' ? '偏跌' : p7d.predicted_direction || '--'}
              </AnalysisPill>
            </div>
            {p7d.confidence && <span className="muted" style={{ fontSize: '11px' }}>置信度: {p7d.confidence}</span>}
            {p7d.has_positive_edge != null && (
              <span className="muted" style={{ fontSize: '11px', marginLeft: 8 }}>
                正边距: {p7d.has_positive_edge ? '是' : '否'}
              </span>
            )}
          </div>
        )}

        {/* 30 days */}
        {p30d.up_probability != null && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: '12px', marginBottom: 4 }}>30天预测</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>上涨概率 {p30d.up_probability}%</span>
              <AnalysisPill tone={getDecisionTone(p30d.predicted_direction)}>
                {p30d.predicted_direction === 'up' ? '偏涨' : p30d.predicted_direction === 'down' ? '偏跌' : p30d.predicted_direction || '--'}
              </AnalysisPill>
            </div>
            {p30d.confidence && <span className="muted" style={{ fontSize: '11px' }}>置信度: {p30d.confidence}</span>}
            {p30d.has_positive_edge != null && (
              <span className="muted" style={{ fontSize: '11px', marginLeft: 8 }}>
                正边距: {p30d.has_positive_edge ? '是' : '否'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Direction summary */}
      {prediction.direction && (
        <div style={{ marginTop: 8 }}>
          <AnalysisMetric label="短期方向" value={prediction.direction || prediction.trend || '--'} tone={directionTone(prediction.direction)} />
        </div>
      )}
    </div>
  );
}

/** 7. 决策建议（规则版） */
function DecisionAdvice({ decisionAdvice }) {
  if (!decisionAdvice || !decisionAdvice.action) return null;

  const da = decisionAdvice;
  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">规则决策建议</span>
          <h3>{da.summary || '基于规则的复合判断'}</h3>
        </div>
        <AnalysisPill tone={getDecisionTone(da.action)}>
          {da.action_label || da.action || '--'}
        </AnalysisPill>
      </div>

      {da.confidence && (
        <div className="native-analysis-metrics-grid compact" style={{ marginBottom: 8 }}>
          <AnalysisMetric label="置信度" value={da.confidence} tone={getDecisionTone(da.action)} />
        </div>
      )}

      {Array.isArray(da.reasons) && da.reasons.length > 0 && (
        <ul className="native-analysis-list">
          {da.reasons.slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}

      {Array.isArray(da.risk_warnings) && da.risk_warnings.length > 0 && (
        <div style={{ marginTop: 6, fontSize: '12px', color: '#fca5a5' }}>
          <strong>⚠ </strong>
          {da.risk_warnings.slice(0, 3).join('；')}
        </div>
      )}
    </div>
  );
}

/** 8. 宏观市场数据 */
function MacroSection({ macro }) {
  if (!macro) return null;
  const ms = macro.macro_summary || {};
  return (
    <div className="native-analysis-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">宏观市场</span>
          <h3>市场概览与风险因子</h3>
        </div>
        <AnalysisPill tone={macro.status === 'ok' ? 'up' : macro.status === 'warn' ? 'warn' : 'down'}>
          {macro.status === 'ok' ? '正常' : macro.status === 'warn' ? '预警' : macro.status || '--'}
        </AnalysisPill>
      </div>

      {/* Summary */}
      {macro.summary && <p className="native-analysis-summary">{macro.summary}</p>}

      {/* Macro summary dimensions */}
      {Object.keys(ms).length > 0 && (
        <div className="native-analysis-metrics-grid">
          {ms.risk_appetite && <AnalysisMetric label="风险偏好" value={{neutral:'中性',cautious:'谨慎',aggressive:'积极'}[ms.risk_appetite] || ms.risk_appetite} />}
          {ms.overseas_direction && <AnalysisMetric label="海外方向" value={{mixed:'震荡',bullish:'偏多',bearish:'偏空'}[ms.overseas_direction] || ms.overseas_direction} />}
          {ms.forex_pressure && <AnalysisMetric label="汇率压力" value={{moderate:'中等',low:'较低',high:'较高'}[ms.forex_pressure] || ms.forex_pressure} />}
          {ms.commodity_disturbance && <AnalysisMetric label="大宗商品扰动" value={{low:'低',moderate:'中等',high:'高'}[ms.commodity_disturbance] || ms.commodity_disturbance} />}
          {ms.text && <AnalysisMetric label="宏观叙述" value={ms.text} />}
        </div>
      )}

      {/* Risk factors */}
      {Array.isArray(macro.risk_factors) && macro.risk_factors.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>风险因子</span>
          <ul className="native-analysis-list">{macro.risk_factors.slice(0, 6).map((rf, i) => <li key={i}>{rf}</li>)}</ul>
        </div>
      )}

      {/* Global indices */}
      {Array.isArray(macro.global_indices) && macro.global_indices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>全球指数</span>
          <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {macro.global_indices.map((idx, i) => (
              <div key={i} className="native-analysis-metric" style={{ padding: '4px 0' }}>
                <span>{idx.name || '--'}</span>
                <strong className={idx.change_pct > 0 ? 'tone-up' : idx.change_pct < 0 ? 'tone-down' : ''}>
                  {idx.change_pct != null ? `${idx.change_pct >= 0 ? '+' : ''}${idx.change_pct.toFixed(2)}%` : '--'}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forex */}
      {Array.isArray(macro.forex) && macro.forex.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>外汇</span>
          <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {macro.forex.map((fx, i) => (
              <div key={i} className="native-analysis-metric" style={{ padding: '4px 0' }}>
                <span>{fx.name || '--'}</span>
                <strong className={fx.change_pct > 0 ? 'tone-up' : fx.change_pct < 0 ? 'tone-down' : ''}>
                  {fx.change_pct != null ? `${fx.change_pct >= 0 ? '+' : ''}${fx.change_pct.toFixed(2)}%` : fx.latest ?? '--'}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commodities */}
      {Array.isArray(macro.commodities) && macro.commodities.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>大宗商品</span>
          <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {macro.commodities.map((c, i) => (
              <div key={i} className="native-analysis-metric" style={{ padding: '4px 0' }}>
                <span>{c.name || '--'}</span>
                <strong className={c.change_pct > 0 ? 'tone-up' : c.change_pct < 0 ? 'tone-down' : ''}>
                  {c.change_pct != null ? `${c.change_pct >= 0 ? '+' : ''}${c.change_pct.toFixed(2)}%` : c.latest ?? '--'}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interbank rates */}
      {Array.isArray(macro.interbank_rates) && macro.interbank_rates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px' }}>银行间利率</span>
          <div className="native-analysis-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {macro.interbank_rates.map((ir, i) => (
              <div key={i} className="native-analysis-metric" style={{ padding: '4px 0' }}>
                <span>{ir.name || '--'}</span>
                <strong>{ir.latest != null ? `${ir.latest.toFixed(2)}%` : '--'}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* As of */}
      {macro.as_of && (
        <div className="muted" style={{ fontSize: '11px', textAlign: 'right', marginTop: 8 }}>
          数据截至: {macro.as_of}
        </div>
      )}
    </div>
  );
}

/** 9. 小额资金决策（高置信度模式） */
function HighConfidenceDecisionSection({ highConfidence }) {
  if (!highConfidence || !highConfidence.action) return null;
  const hc = highConfidence;
  return (
    <div className="native-analysis-card high-confidence-card">
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">💡 小额资金决策（高置信度模式）</span>
          <h3>{hc.action_label || '建议操作'}</h3>
        </div>
        <AnalysisPill tone={hc.action === 'buy' ? 'up' : hc.action === 'sell' ? 'down' : 'warn'}>
          {hc.action_label || hc.action || '--'}
        </AnalysisPill>
      </div>

      <p className="native-analysis-summary muted" style={{ fontSize: '13px' }}>
        策略说明："小资金、高胜率优先、少出手" — 默认等待，仅在所有硬条件同时满足时才考虑小额试探。
      </p>

      {/* Stats row */}
      <div className="native-analysis-metrics-grid compact" style={{ marginBottom: 8 }}>
        <AnalysisMetric label="置信度" value={hc.confidence === 'high' ? '高' : hc.confidence === 'medium' ? '中' : hc.confidence || '--'} tone={hc.confidence === 'high' ? 'up' : hc.confidence === 'low' ? 'down' : ''} />
        <AnalysisMetric label="综合评分" value={hc.score != null ? `${hc.score}` : '--'} />
        {hc.max_position_pct > 0 && <AnalysisMetric label="最大仓位" value={`${hc.max_position_pct}%`} />}
      </div>

      {/* Passed conditions */}
      {Array.isArray(hc.reasons) && hc.reasons.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px', color: '#34d399' }}>✅ 通过的条件</span>
          <ul className="native-analysis-list" style={{ color: '#34d399' }}>
            {hc.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {Array.isArray(hc.blockers) && hc.blockers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px', color: '#f87171' }}>❌ 未通过的条件</span>
          <ul className="native-analysis-list" style={{ color: '#fca5a5' }}>
            {hc.blockers.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Risk controls */}
      {Array.isArray(hc.risk_controls) && hc.risk_controls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '12px', color: '#fbbf24' }}>🛡️ 风险控制规则</span>
          <ul className="native-analysis-list" style={{ color: '#fcd34d' }}>
            {hc.risk_controls.slice(0, 5).map((rc, i) => <li key={i}>{rc}</li>)}
          </ul>
        </div>
      )}

      {hc.disclaimer && <p className="muted" style={{ fontSize: '11px', marginTop: 8, lineHeight: 1.4 }}>{hc.disclaimer}</p>}
    </div>
  );
}

/** 10. 回测验证摘要 */
function BacktestSummarySection({ backtestSummary }) {
  if (!backtestSummary) return null;
  const bs = backtestSummary;
  return (
    <div className="native-analysis-card" style={{ fontSize: '13px' }}>
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">回测验证</span>
          <h3>模型回测与预测质量</h3>
        </div>
        <AnalysisPill tone={bs.probability_quality === 'high' ? 'up' : bs.probability_quality === 'medium' ? 'warn' : 'down'}>
          {bs.probability_quality === 'high' ? '高' : bs.probability_quality === 'medium' ? '中' : bs.probability_quality || '--'}
        </AnalysisPill>
      </div>
      <div className="native-analysis-metrics-grid compact">
        {bs['7d_directional_accuracy'] && <AnalysisMetric label="7天方向准确率" value={bs['7d_directional_accuracy']} />}
        {bs['30d_directional_accuracy'] && <AnalysisMetric label="30天方向准确率" value={bs['30d_directional_accuracy']} />}
        {bs.probability_quality && <AnalysisMetric label="概率质量" value={{high:'高',medium:'中',low:'低'}[bs.probability_quality] || bs.probability_quality} />}
      </div>
      {bs._note && <p className="muted" style={{ fontSize: '12px', marginTop: 6, lineHeight: 1.4 }}>{bs._note}</p>}
    </div>
  );
}

/** 8. 数据源状态 */
function DatasourceStatus({ datasourceStatus }) {
  if (!datasourceStatus) return null;
  const ds = datasourceStatus;
  return (
    <div className="native-analysis-card" style={{ fontSize: '12px' }}>
      <div className="native-analysis-card-head">
        <div>
          <span className="native-analysis-kicker">数据源</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(ds).map(([key, val]) => {
          const status = val ? (typeof val === 'boolean' || val === 'ok' || val === 'success' ? 'up' : 'neutral') : 'down';
          return (
            <span key={key} className={`native-analysis-pill tone-${status}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
              {key}: {typeof val === 'boolean' ? (val ? 'ok' : 'err') : String(val).slice(0, 20)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

/**
 * 全功能基金分析结果组件
 * 渲染 fund-analysis-agent 后端的全部返回字段
 */
export default function FundAnalysisResult({ result, showRaw, onToggleRaw }) {
  if (!result) return null;
  if (!result.success) {
    return (
      <div className="native-analysis-card native-analysis-error">
        <h3>分析失败</h3>
        <p>{result.error || '没有拿到有效分析结果'}</p>
      </div>
    );
  }

  const fund = result.fund || {};
  const fundProfile = result.fund_profile || {};
  const metrics = result.metrics || {};
  const risk = result.risk || {};
  const forecast = result.forecast || {};
  const prediction = result.prediction || {};
  const analysis = result.analysis || {};
  const finalDecision = result.final_decision || {};
  const highConfidence = result.high_confidence_decision || {};
  const decisionAdvice = result.decision_advice || {};
  const macro = result.macro || {};
  const datasourceStatus = result.datasource_status || {};

  return (
    <div className="native-analysis-results">
      {/* 1. Final conclusion */}
      <HeroDecision finalDecision={finalDecision} analysis={analysis} fund={fund} />

      {/* 1.5 小额资金决策 */}
      <HighConfidenceDecisionSection highConfidence={highConfidence} />

      {/* 2. Fund profile (card 1) */}
      {Object.keys(fundProfile).length > 0 ? (
        <FundProfileSection fund={fund} fundProfile={fundProfile} metrics={metrics} />
      ) : (
        <div className="native-analysis-card">
          <div className="native-analysis-card-head">
            <div>
              <span className="native-analysis-kicker">基金信息</span>
              <h3>{fund.name || '未知基金'}</h3>
            </div>
            <span className="fund-code-badge">#{fund.code || '--'}</span>
          </div>
          <div className="native-analysis-tags">
            <AnalysisPill>{fund.type || '类型未知'}</AnalysisPill>
            <AnalysisPill>{fund.company || '公司未知'}</AnalysisPill>
            {metrics.current_estimate?.estimate_time && <AnalysisPill>估值 {metrics.current_estimate.estimate_time}</AnalysisPill>}
          </div>
          <div className="native-analysis-metrics-grid">
            <AnalysisMetric label="最新净值" value={fmt(metrics.latest_nav)} />
            <AnalysisMetric label="日涨跌" value={fmtPct(metrics.daily_return)} tone={metrics.daily_return > 0 ? 'up' : metrics.daily_return < 0 ? 'down' : ''} />
            <AnalysisMetric label="估算涨跌" value={metrics.current_estimate?.estimated_change_pct != null ? fmtPct(metrics.current_estimate.estimated_change_pct) : '--'} tone={metrics.current_estimate?.estimated_change_pct > 0 ? 'up' : metrics.current_estimate?.estimated_change_pct < 0 ? 'down' : ''} />
            <AnalysisMetric label="最大回撤" value={metrics.max_drawdown != null ? `${fmt(metrics.max_drawdown, 1)}%` : '--'} tone="down" />
          </div>
        </div>
      )}

      {/* 3. Full metrics dashboard */}
      <MetricsDashboard metrics={metrics} fund={fund} />

      {/* 4. Risk breakdown + prediction in two-column grid */}
      <div className="native-analysis-grid two">
        <RiskBreakdown risk={risk} />
        <PredictionDetail prediction={prediction} />
      </div>

      {/* 5. Forecast block */}
      <ForecastBlock forecast={forecast} />

      {/* 5.5 宏观市场 */}
      <MacroSection macro={macro} />

      {/* 6. Decision advice (rule-based) */}
      <DecisionAdvice decisionAdvice={decisionAdvice} />

      {/* 7. Strategy details */}
      <div className="native-analysis-card">
        <div className="native-analysis-card-head">
          <div>
            <span className="native-analysis-kicker">策略细节</span>
            <h3>买入、减仓与观察条件</h3>
          </div>
          <button className="button secondary analysis-button small" onClick={onToggleRaw}>
            {showRaw ? '收起原始数据' : '查看原始数据'}
          </button>
        </div>
        <div className="native-analysis-grid three">
          <div>
            <h4>可考虑买入</h4>
            <ul className="native-analysis-list">
              {(analysis.buy_conditions || highConfidence?.buy_conditions || ['暂无明确买入条件']).slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div>
            <h4>需要减仓</h4>
            <ul className="native-analysis-list">
              {(analysis.reduce_conditions || highConfidence?.sell_conditions || ['暂无明确减仓条件']).slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div>
            <h4>重点观察</h4>
            <ul className="native-analysis-list">
              {(analysis.watch_points || finalDecision?.warning || ['继续观察净值、估值和市场风格变化']).slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
        {showRaw && (
          <pre className="native-analysis-raw">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>

      {/* 8. Datasource status */}
      {Object.keys(datasourceStatus).length > 0 && (
        <DatasourceStatus datasourceStatus={datasourceStatus} />
      )}

      {/* 9. 回测验证 */}
      {result.backtest_summary && <BacktestSummarySection backtestSummary={result.backtest_summary} />}

      {/* Disclaimer */}
      {result.disclaimer && (
        <div className="muted" style={{ fontSize: '11px', textAlign: 'center', padding: '8px', lineHeight: 1.4 }}>
          {result.disclaimer}
        </div>
      )}
    </div>
  );
}
