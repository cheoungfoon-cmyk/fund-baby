'use client';

import { useState, useMemo } from 'react';
import { evaluateFundSignal, generateManagerAdvice } from '../lib/tradingSignal';

function fmtPct(v) {
  if (v == null) return '--';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtAmt(v) {
  if (v == null || isNaN(v)) return '--';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '万';
  return v.toFixed(2);
}

function SignalBadge({ action, label, small }) {
  const colors = {
    buy: { bg: 'rgba(67,242,189,0.15)', text: '#43f2bd', border: 'rgba(67,242,189,0.25)', label: '买入' },
    watch_buy: { bg: 'rgba(255,209,102,0.15)', text: '#ffd166', border: 'rgba(255,209,102,0.25)', label: '关注买入' },
    watch_sell: { bg: 'rgba(255,209,102,0.15)', text: '#ffd166', border: 'rgba(255,209,102,0.25)', label: '关注卖出' },
    sell: { bg: 'rgba(255,91,115,0.15)', text: '#ff5b73', border: 'rgba(255,91,115,0.25)', label: '卖出' },
    hold: { bg: 'rgba(142,169,188,0.1)', text: '#8ea9bc', border: 'transparent', label: '观望' },
  };
  const c = colors[action] || colors.hold;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '1px 6px' : '3px 10px',
      borderRadius: 6, fontSize: small ? 11 : 13, fontWeight: 700,
      background: c.bg, color: c.text, border: '1px solid ' + c.border,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}

/** 基金经理建议卡片 */
function ManagerAdviceCard({ fund, position, signal }) {
  if (!signal || !signal.hasRecommendation) return null;
  const advice = signal.managerAdvice || {};
  const color = signal.actionTone === 'up' ? '#43f2bd' : signal.actionTone === 'down' ? '#ff5b73' : '#ffd166';
  const hasPosition = position && position.share > 0;

  return (
    <div className="pd-fund-card glass">
      <div className="pd-fund-header">
        <div className="pd-fund-info">
          <strong>{fund.name || fund.code}</strong>
          <span className="muted" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
            {fund.code} · 净值 {Number(fund.dwjz || 0).toFixed(4)}
            {fund.gszzl != null && (
              <span style={{ marginLeft: 6, color: Number(fund.gszzl) > 0 ? '#43f2bd' : Number(fund.gszzl) < 0 ? '#ff5b73' : '#999' }}>
                估值 {fmtPct(fund.gszzl)}
              </span>
            )}
          </span>
        </div>
        <SignalBadge action={signal.action} />
      </div>

      {/* 基金经理的判断 */}
      <div className="pd-advice-box" style={{ borderLeft: '3px solid ' + color }}>
        <p><strong>{advice.summary || signal.actionLabel}</strong></p>
      </div>

      {/* 判断依据 */}
      {signal.signals && signal.signals.length > 0 && (
        <div className="pd-reasons">
          <span className="pd-reason-label">判断依据</span>
          {signal.signals.slice(0, 5).map((s, i) => (
            <div key={i} className="pd-reason-row">
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: s.type === 'buy' ? '#43f2bd' : '#ff5b73', marginRight: 6, flexShrink: 0, marginTop: 6,
              }} />
              <span>{s.name}{s.detail ? <span className="muted" style={{ fontSize: 11 }}>（{s.detail}）</span> : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* 持有情况 */}
      {hasPosition && (
        <div className="pd-position-row">
          <span style={{ fontSize: 12, color: '#8ea9bc' }}>持仓成本 {Number(position.cost).toFixed(4)}</span>
          <span style={{ fontSize: 12, color: '#8ea9bc' }}>份额 {position.share}份</span>
          {position.cost > 0 && fund.dwjz > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: Number(fund.dwjz) > position.cost ? '#43f2bd' : '#ff5b73',
            }}>
              盈亏 {fmtPct((Number(fund.dwjz) - position.cost) / position.cost * 100)}
            </span>
          )}
        </div>
      )}

      {/* 分数条 */}
      <div className="pd-score-bar">
        <div className="pd-score-track">
          <div className="pd-score-fill" style={{
            width: Math.max(3, Math.min(97, (signal.netScore + 100) / 2)) + '%',
            background: signal.netScore > 0 ? '#43f2bd' : signal.netScore < 0 ? '#ff5b73' : '#8ea9bc',
          }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: 'right',
          color: signal.netScore > 0 ? '#43f2bd' : signal.netScore < 0 ? '#ff5b73' : '#8ea9bc',
        }}>{signal.netScore >= 0 ? '+' : ''}{signal.netScore}</span>
      </div>
    </div>
  );
}

export default function PortfolioDashboard({ funds, holdings, config }) {
  // ─── 计算所有基金的买卖信号 + 基金经理判断 ─────────────────
  const analysis = useMemo(() => {
    if (!funds || funds.length === 0) return null;
    const signals = funds.map(f => {
      const pos = holdings?.[f.code] || null;
      const sig = evaluateFundSignal(f, pos, config);
      const advice = generateManagerAdvice(sig, f, pos);
      return {
        code: f.code, name: f.name, fund: f, position: pos,
        ...sig, managerAdvice: advice, gszzl: f.gszzl, dwjz: f.dwjz,
      };
    });

    const buys = signals.filter(s => s.action === 'buy');
    const sells = signals.filter(s => s.action === 'sell');
    const watchBuys = signals.filter(s => s.action === 'watch_buy');
    const watchSells = signals.filter(s => s.action === 'watch_sell');
    const recommendations = signals.filter(s => s.hasRecommendation)
      .sort((a, b) => Math.abs(b.netScore) - Math.abs(a.netScore));

    return {
      signals,
      recommendations,
      buyCount: buys.length,
      sellCount: sells.length,
      watchBuyCount: watchBuys.length,
      watchSellCount: watchSells.length,
      hasAction: buys.length > 0 || sells.length > 0,
      topBuys: buys.slice(0, 3),
      topSells: sells.slice(0, 3),
    };
  }, [funds, holdings, config]);

  // ─── 汇总数据 ──────────────────────────────────────────
  const summary = useMemo(() => {
    if (!funds || funds.length === 0) return {};
    let totalValue = 0, totalCost = 0, todayChange = 0;
    let holdingCount = 0, hasHoldings = false;
    let todayUp = 0, todayDown = 0;

    for (const f of funds) {
      const pos = holdings?.[f.code];
      const gszzl = Number(f.gszzl) || 0;
      if (gszzl > 0) todayUp++;
      else if (gszzl < 0) todayDown++;

      if (pos && pos.share > 0) {
        hasHoldings = true;
        const shares = pos.share || 0;
        const cost = pos.cost || 0;
        const nav = Number(f.dwjz) || 0;
        if (shares > 0 && nav > 0) {
          totalValue += shares * nav;
          totalCost += shares * cost;
          holdingCount++;
          if (gszzl !== 0) {
            const holdingValue = shares * nav;
            const dayChange = holdingValue - (holdingValue / (1 + gszzl / 100));
            todayChange += dayChange;
          }
        }
      }
    }

    const pnl = totalValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    return {
      totalValue, totalCost, pnl, pnlPct, todayChange,
      fundCount: funds.length, holdingCount,
      hasHoldings, todayUp, todayDown, todayNeutral: funds.length - todayUp - todayDown,
    };
  }, [funds, holdings]);

  if (!analysis || funds.length === 0) return null;

  const { recommendations } = analysis;

  return (
    <div className="pd-container glass">
      {/* ─── 汇总条 ─────────────────────────────── */}
      <div className="pd-summary-row">
        <div className="pd-stat-card">
          <span className="pd-stat-label">追踪基金</span>
          <span className="pd-stat-value">{summary.fundCount || 0}</span>
        </div>
        {summary.hasHoldings && (
          <>
            <div className="pd-stat-card">
              <span className="pd-stat-label">持仓基金</span>
              <span className="pd-stat-value">{summary.holdingCount || 0}</span>
            </div>
            <div className="pd-stat-card">
              <span className="pd-stat-label">持仓市值</span>
              <span className="pd-stat-value">{fmtAmt(summary.totalValue)}</span>
            </div>
            <div className={`pd-stat-card ${summary.pnl > 0 ? 'pd-up' : summary.pnl < 0 ? 'pd-down' : ''}`}>
              <span className="pd-stat-label">累计盈亏</span>
              <span className="pd-stat-value">{summary.pnl > 0 ? '+' : ''}{fmtAmt(summary.pnl)}<small>{summary.pnlPct > 0 ? '+' : ''}{summary.pnlPct.toFixed(2)}%</small></span>
            </div>
            <div className={`pd-stat-card ${summary.todayChange > 0 ? 'pd-up' : summary.todayChange < 0 ? 'pd-down' : ''}`}>
              <span className="pd-stat-label">今日估算</span>
              <span className="pd-stat-value">{summary.todayChange > 0 ? '+' : ''}{fmtAmt(summary.todayChange)}</span>
            </div>
          </>
        )}
        {!summary.hasHoldings && (
          <div className="pd-stat-card">
            <span className="pd-stat-label">今日表现</span>
            <span className="pd-stat-value" style={{ fontSize: 14 }}>
              <span style={{ color: '#43f2bd' }}>{summary.todayUp}涨</span>
              <span style={{ margin: '0 4px', color: '#8ea9bc' }}>/</span>
              <span style={{ color: '#ff5b73' }}>{summary.todayDown}跌</span>
              <span style={{ margin: '0 4px', color: '#8ea9bc' }}>/</span>
              <span style={{ color: '#8ea9bc' }}>{summary.todayNeutral}平</span>
            </span>
          </div>
        )}
        <div className="pd-stat-card">
          <span className="pd-stat-label">信号</span>
          <span className="pd-stat-value pd-signal-stack">
            {analysis.buyCount > 0 && <SignalBadge action="buy" small />}
            {analysis.sellCount > 0 && <SignalBadge action="sell" small />}
            {analysis.watchBuyCount + analysis.watchSellCount > 0 && <SignalBadge action="watch_buy" small />}
            {analysis.buyCount === 0 && analysis.sellCount === 0 && analysis.watchBuyCount === 0 && <span className="pd-signal-hold">0</span>}
          </span>
        </div>
      </div>

      {/* ─── 基金经理建议 ───────────────────────── */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8, padding: '0 2px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#bdefff' }}>
              基金经理判断 · {recommendations.length}条建议
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              基于实时估值 + 技术指标的多因子评分
            </span>
          </div>
          <div className="pd-advice-list">
            {recommendations.map(sig => (
              <ManagerAdviceCard
                key={sig.code} fund={sig.fund}
                position={sig.position} signal={sig}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── 今日全部信号 ──────────────────────── */}
      {analysis.hasAction && (
        <details className="pd-alert-details" style={{ marginTop: 14 }} open>
          <summary className="pd-alert-summary">
            <span>今日信号详情（{analysis.buyCount + analysis.sellCount + analysis.watchBuyCount + analysis.watchSellCount}条）</span>
          </summary>
          <div className="pd-alert-list">
            {analysis.signals.filter(s => s.hasRecommendation).map(sig => (
              <div key={sig.code} className={`pd-alert-item pd-alert-${sig.actionTone === 'up' ? 'info' : sig.actionTone === 'down' ? 'danger' : 'warning'}`}>
                <div className="pd-alert-icon">
                  {sig.actionTone === 'up' ? '🟢' : sig.actionTone === 'down' ? '🔴' : '🟡'}
                </div>
                <div className="pd-alert-body">
                  <strong>{sig.name || sig.code}</strong>
                  <p>{sig.managerAdvice?.summary || sig.actionLabel}</p>
                  {sig.signals && sig.signals.length > 0 && (
                    <div className="pd-alert-tags">
                      {sig.signals.slice(0, 3).map((s, j) => (
                        <span key={j} className={`pd-signal-chip ${s.type}`}>{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
