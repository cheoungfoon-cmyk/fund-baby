'use client';

import { useState, useMemo, useCallback } from 'react';
import { evaluateFundSignal, evaluatePortfolio } from '../lib/tradingSignal';

/** 组合看板 + 持仓分析 + 智能预警 */
export default function PortfolioDashboard({ funds, holdings, config }) {
  // ─── 计算所有基金的买卖信号 ──────────────────────────────
  const analysis = useMemo(() => {
    if (!funds || funds.length === 0) return null;
    const signals = funds.map(f => {
      const pos = holdings?.[f.code] || null;
      const sig = evaluateFundSignal(f, pos, config);
      return { code: f.code, name: f.name, ...sig, gszzl: f.gszzl, dwjz: f.dwjz };
    });
    const portfolio = evaluatePortfolio(signals);
    return { signals, portfolio };
  }, [funds, holdings, config]);

  // ─── 预警规则计算 ──────────────────────────────────────
  const alerts = useMemo(() => {
    if (!analysis) return [];
    const list = [];
    const threshold = config?.alertThreshold || 3;

    for (const sig of analysis.signals) {
      // 强烈卖出信号 → 预警
      if (sig.action === 'sell') {
        list.push({
          level: 'danger',
          fund: sig.name,
          message: `${sig.name}：建议减仓（净评分${sig.netScore}）`,
          signals: sig.signals,
        });
      }
      // 估值大跌
      if (sig.gszzl != null && Number(sig.gszzl) <= -threshold) {
        list.push({
          level: 'warning',
          fund: sig.name,
          message: `${sig.name} 盘中跌${Math.abs(Number(sig.gszzl)).toFixed(2)}%`,
          signals: [{ name: `跌${Math.abs(Number(sig.gszzl)).toFixed(2)}%`, type: 'alert' }],
        });
      }
      // 买入机会
      if (sig.action === 'buy') {
        list.push({
          level: 'info',
          fund: sig.name,
          message: `${sig.name}：出现买入机会（净评分${sig.netScore}）`,
          signals: sig.signals,
        });
      }
    }
    // 去重
    return list.filter((item, idx) => list.findIndex(i => i.message === item.message) === idx);
  }, [analysis, config]);

  // ─── 收益汇总 ──────────────────────────────────────────
  const summary = useMemo(() => {
    if (!funds || funds.length === 0) return {};
    let totalValue = 0;
    let totalCost = 0;
    let todayChange = 0;
    let fundCount = 0;
    let holdingCount = 0;

    for (const f of funds) {
      const pos = holdings?.[f.code];
      if (pos) {
        const shares = pos.holdingUnits || pos.holding_units || 0;
        const cost = pos.costNav || pos.cost_nav || 0;
        const nav = Number(f.dwjz) || 0;
        if (shares > 0) {
          totalValue += shares * nav;
          totalCost += shares * cost;
          holdingCount++;
        }
        // 今日涨跌
        const gszzl = Number(f.gszzl) || 0;
        if (gszzl !== 0 && nav > 0) {
          const holdingValue = shares * nav;
          todayChange += holdingValue * gszzl / (100 + gszzl);
        }
      }
      fundCount++;
    }

    const pnl = totalValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    return { totalValue, totalCost, pnl, pnlPct, todayChange, fundCount, holdingCount };
  }, [funds, holdings]);

  if (!analysis || funds.length === 0) return null;

  const { portfolio } = analysis;

  return (
    <div className="pd-container glass">
      {/* 顶部汇总条 */}
      <div className="pd-summary-row">
        <div className="pd-stat-card">
          <span className="pd-stat-label">持仓基金</span>
          <span className="pd-stat-value">{summary.holdingCount || 0}<small>/{summary.fundCount || 0}</small></span>
        </div>
        <div className="pd-stat-card">
          <span className="pd-stat-label">持仓市值</span>
          <span className="pd-stat-value">{(summary.totalValue || 0) > 9999 ? `${(summary.totalValue / 10000).toFixed(2)}万` : (summary.totalValue || 0).toFixed(2)}</span>
        </div>
        <div className={`pd-stat-card ${summary.pnl > 0 ? 'pd-up' : summary.pnl < 0 ? 'pd-down' : ''}`}>
          <span className="pd-stat-label">累计盈亏</span>
          <span className="pd-stat-value">{summary.pnl > 0 ? '+' : ''}{(summary.pnl || 0).toFixed(2)}<small>{summary.pnlPct > 0 ? '+' : ''}{summary.pnlPct.toFixed(2)}%</small></span>
        </div>
        <div className={`pd-stat-card ${summary.todayChange > 0 ? 'pd-up' : summary.todayChange < 0 ? 'pd-down' : ''}`}>
          <span className="pd-stat-label">今日估算</span>
          <span className="pd-stat-value">{summary.todayChange > 0 ? '+' : ''}{(summary.todayChange || 0).toFixed(2)}</span>
        </div>
        <div className="pd-stat-card">
          <span className="pd-stat-label">信号</span>
          <span className="pd-stat-value pd-signal-stack">
            {portfolio.buyCount > 0 && <span className="pd-signal-buy" title="建议买入">{portfolio.buyCount}买</span>}
            {portfolio.sellCount > 0 && <span className="pd-signal-sell" title="建议卖出">{portfolio.sellCount}卖</span>}
            {(portfolio.watchBuyCount || portfolio.watchSellCount) > 0 && <span className="pd-signal-warn" title="关注中">{(portfolio.watchBuyCount || 0) + (portfolio.watchSellCount || 0)}观</span>}
            {portfolio.buyCount === 0 && portfolio.sellCount === 0 && <span className="pd-signal-hold">0</span>}
          </span>
        </div>
        {alerts.length > 0 && (
          <div className="pd-stat-card pd-alert-stat">
            <span className="pd-stat-label">预警</span>
            <span className="pd-stat-value pd-alert-count">{alerts.length}</span>
          </div>
        )}
      </div>

      {/* 今日信号详情（折叠） */}
      {alerts.length > 0 && (
        <details className="pd-alert-details" open>
          <summary className="pd-alert-summary">
            <span>今日信号（{alerts.length}条）</span>
            <span className="muted" style={{ fontSize: '12px', marginLeft: 8 }}>点击展开/收起</span>
          </summary>
          <div className="pd-alert-list">
            {alerts.slice(0, 8).map((alert, i) => (
              <div key={i} className={`pd-alert-item pd-alert-${alert.level}`}>
                <div className="pd-alert-icon">
                  {alert.level === 'danger' ? '🔴' : alert.level === 'warning' ? '🟡' : '🟢'}
                </div>
                <div className="pd-alert-body">
                  <strong>{alert.fund}</strong>
                  <p>{alert.message}</p>
                  {alert.signals && alert.signals.length > 0 && (
                    <div className="pd-alert-tags">
                      {alert.signals.slice(0, 3).map((s, j) => (
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
