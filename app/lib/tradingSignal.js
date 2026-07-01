/**
 * 基金买卖信号引擎
 * 
 * 基于多因子评分系统，综合评估每只基金的买入/卖出/观望信号
 * 
 * 评分维度:
 * 1. 实时估值偏离 (gszzl)    权重: 10%
 * 2. 持仓盈亏 (成本 vs 现价)  权重: 15%
 * 3. 仓位集中度              权重: 10%
 * 4. RSI 相对强弱            权重: 12%
 * 5. 均线位置 (距MA20)       权重: 12%
 * 6. 均线趋势 (多头/空头)     权重: 10%
 * 7. 波动率                  权重: 8%
 * 8. 连涨/连跌               权重: 8%
 * 9. 最大回撤                权重: 10%
 * 10. 趋势信号               权重: 5%
 * ──────────────────────────
 * 合计:                     100%
 */

export const SIGNAL_WEIGHTS = {
  VALUATION_DEVIATION: 0.10,
  POSITION_PNL: 0.15,
  POSITION_CONCENTRATION: 0.10,
  RSI: 0.12,
  MA_POSITION: 0.12,
  MA_TREND: 0.10,
  VOLATILITY: 0.08,
  CONSECUTIVE_DAYS: 0.08,
  MAX_DRAWDOWN: 0.10,
  TREND_BASIC: 0.05,
};

const THRESHOLDS = {
  BUY_STRONG: 0.30,    // netScore >= 0.30 → 买入
  BUY_WATCH: 0.15,     // netScore >= 0.15 → 关注买入
  SELL_WATCH: -0.15,   // netScore <= -0.15 → 关注卖出
  SELL_STRONG: -0.30,  // netScore <= -0.30 → 卖出
};

/**
 * 评估单只基金的买卖信号
 * @param {Object} fund - 基金数据 { dwjz, gszzl, historyTrend, ... }
 * @param {Object} position - 用户持仓 { costNav, holdingAmount, holdingPercent, ... }，可能为null
 * @param {Object} options - 可选配置 { alertThresholds, ... }
 * @returns {Object} 信号结果
 */
export function evaluateFundSignal(fund, position, options = {}) {
  const signals = [];
  let buyScore = 0;
  let sellScore = 0;

  // ─── 1. 实时估值偏离 ────────────────────────────────────
  if (fund.gszzl != null && Number.isFinite(Number(fund.gszzl))) {
    const gszzl = Number(fund.gszzl);
    if (gszzl <= -2.5) {
      signals.push({ type: 'buy', name: '估值大跌(>2.5%)', weight: SIGNAL_WEIGHTS.VALUATION_DEVIATION, detail: `${gszzl.toFixed(2)}%` });
      buyScore += SIGNAL_WEIGHTS.VALUATION_DEVIATION;
    } else if (gszzl >= 2.5) {
      signals.push({ type: 'sell', name: '估值大涨(>2.5%)', weight: SIGNAL_WEIGHTS.VALUATION_DEVIATION, detail: `+${gszzl.toFixed(2)}%` });
      sellScore += SIGNAL_WEIGHTS.VALUATION_DEVIATION;
    }
  }

  // ─── 2. 持仓盈亏 ────────────────────────────────────────
  if (position) {
    const costNav = position.costNav || position.cost_nav;
    const currentNav = Number(fund.dwjz);
    if (costNav && currentNav && !isNaN(costNav) && currentNav > 0) {
      const returnPct = (currentNav - costNav) / costNav * 100;
      if (returnPct <= -10) {
        signals.push({ type: 'buy', name: '低于成本>10%', weight: SIGNAL_WEIGHTS.POSITION_PNL, detail: `${returnPct.toFixed(1)}%` });
        buyScore += SIGNAL_WEIGHTS.POSITION_PNL;
      } else if (returnPct >= 20) {
        signals.push({ type: 'sell', name: '盈利>20%', weight: SIGNAL_WEIGHTS.POSITION_PNL, detail: `+${returnPct.toFixed(1)}%` });
        sellScore += SIGNAL_WEIGHTS.POSITION_PNL;
      } else if (returnPct <= -5) {
        signals.push({ type: 'buy', name: '小幅低于成本', weight: SIGNAL_WEIGHTS.POSITION_PNL * 0.6, detail: `${returnPct.toFixed(1)}%` });
        buyScore += SIGNAL_WEIGHTS.POSITION_PNL * 0.6;
      } else if (returnPct >= 10) {
        signals.push({ type: 'sell', name: '盈利超10%', weight: SIGNAL_WEIGHTS.POSITION_PNL * 0.6, detail: `+${returnPct.toFixed(1)}%` });
        sellScore += SIGNAL_WEIGHTS.POSITION_PNL * 0.6;
      }
    }

    // 仓位集中度
    const pct = position.holdingPercent || position.holding_percent || 0;
    if (pct > 30) {
      signals.push({ type: 'sell', name: '单只过重(>' + pct.toFixed(0) + '%)', weight: SIGNAL_WEIGHTS.POSITION_CONCENTRATION, detail: `${pct.toFixed(0)}%` });
      sellScore += SIGNAL_WEIGHTS.POSITION_CONCENTRATION;
    }
  }

  // ─── 3. 技术指标 ────────────────────────────────────────
  if (fund.historyTrend && fund.historyTrend.length > 20) {
    const trend = fund.historyTrend;
    const latest = trend[trend.length - 1].y;

    // 计算MA
    const ma5 = calcMA(trend, 5);
    const ma10 = calcMA(trend, 10);
    const ma20 = calcMA(trend, 20);
    const ma60 = trend.length >= 60 ? calcMA(trend, 60) : null;

    // RSI
    const rsi = calcRSI(trend, 14);
    if (rsi != null) {
      if (rsi <= 30) {
        signals.push({ type: 'buy', name: 'RSI超卖', weight: SIGNAL_WEIGHTS.RSI, detail: `RSI=${rsi.toFixed(1)}` });
        buyScore += SIGNAL_WEIGHTS.RSI;
      } else if (rsi >= 70) {
        signals.push({ type: 'sell', name: 'RSI超买', weight: SIGNAL_WEIGHTS.RSI, detail: `RSI=${rsi.toFixed(1)}` });
        sellScore += SIGNAL_WEIGHTS.RSI;
      } else if (rsi <= 40) {
        signals.push({ type: 'buy', name: 'RSI偏低', weight: SIGNAL_WEIGHTS.RSI * 0.5, detail: `RSI=${rsi.toFixed(1)}` });
        buyScore += SIGNAL_WEIGHTS.RSI * 0.5;
      } else if (rsi >= 60) {
        signals.push({ type: 'sell', name: 'RSI偏高', weight: SIGNAL_WEIGHTS.RSI * 0.5, detail: `RSI=${rsi.toFixed(1)}` });
        sellScore += SIGNAL_WEIGHTS.RSI * 0.5;
      }
    }

    // 均线位置
    if (ma20 && ma20 > 0) {
      const dev = (latest - ma20) / ma20 * 100;
      if (dev <= -5) {
        signals.push({ type: 'buy', name: '跌破MA20>5%', weight: SIGNAL_WEIGHTS.MA_POSITION, detail: `距MA20 ${dev.toFixed(1)}%` });
        buyScore += SIGNAL_WEIGHTS.MA_POSITION;
      } else if (dev >= 5) {
        signals.push({ type: 'sell', name: '高于MA20>5%', weight: SIGNAL_WEIGHTS.MA_POSITION, detail: `距MA20 +${dev.toFixed(1)}%` });
        sellScore += SIGNAL_WEIGHTS.MA_POSITION;
      }
    }

    // 均线趋势
    if (ma5 && ma10 && ma20 && ma5 > 0 && ma10 > 0 && ma20 > 0) {
      if (ma5 > ma10 && ma10 > ma20) {
        signals.push({ type: 'buy', name: '均线多头', weight: SIGNAL_WEIGHTS.MA_TREND, detail: 'MA5>MA10>MA20' });
        buyScore += SIGNAL_WEIGHTS.MA_TREND;
      } else if (ma5 < ma10 && ma10 < ma20) {
        signals.push({ type: 'sell', name: '均线空头', weight: SIGNAL_WEIGHTS.MA_TREND, detail: 'MA5<MA10<MA20' });
        sellScore += SIGNAL_WEIGHTS.MA_TREND;
      }
    }

    // 趋势信号 (ma5与ma10的金叉/死叉)
    if (ma5 && ma10) {
      const prev5 = calcMATail(trend, 5, 2);
      const prev10 = calcMATail(trend, 10, 2);
      if (prev5 && prev10 && prev5 <= prev10 && ma5 > ma10) {
        signals.push({ type: 'buy', name: '金叉信号', weight: SIGNAL_WEIGHTS.TREND_BASIC, detail: 'MA5上穿MA10' });
        buyScore += SIGNAL_WEIGHTS.TREND_BASIC;
      } else if (prev5 && prev10 && prev5 >= prev10 && ma5 < ma10) {
        signals.push({ type: 'sell', name: '死叉信号', weight: SIGNAL_WEIGHTS.TREND_BASIC, detail: 'MA5下穿MA10' });
        sellScore += SIGNAL_WEIGHTS.TREND_BASIC;
      }
    }

    // MA60 长期趋势
    if (ma60 && ma60 > 0) {
      if (latest > ma60) {
        signals.push({ type: 'buy', name: '站上MA60', weight: SIGNAL_WEIGHTS.MA_POSITION * 0.5, detail: `价格在MA60之上` });
        buyScore += SIGNAL_WEIGHTS.MA_POSITION * 0.5;
      } else {
        signals.push({ type: 'sell', name: '跌破MA60', weight: SIGNAL_WEIGHTS.MA_POSITION * 0.5, detail: '价格在MA60之下' });
        sellScore += SIGNAL_WEIGHTS.MA_POSITION * 0.5;
      }
    }

    // 连涨/连跌
    const cd = calcConsecutiveDays(trend);
    if (cd && cd.days >= 3) {
      if (cd.direction === 'down') {
        signals.push({ type: 'buy', name: `连跌${cd.days}天`, weight: SIGNAL_WEIGHTS.CONSECUTIVE_DAYS, detail: `连续下跌${cd.days}天` });
        buyScore += SIGNAL_WEIGHTS.CONSECUTIVE_DAYS;
      } else if (cd.direction === 'up') {
        signals.push({ type: 'sell', name: `连涨${cd.days}天`, weight: SIGNAL_WEIGHTS.CONSECUTIVE_DAYS, detail: `连续上涨${cd.days}天` });
        sellScore += SIGNAL_WEIGHTS.CONSECUTIVE_DAYS;
      }
    }

    // 最大回撤
    const dd = calcMaxDrawdown(trend);
    if (dd != null && dd > 15) {
      signals.push({ type: 'sell', name: '回撤偏大', weight: SIGNAL_WEIGHTS.MAX_DRAWDOWN, detail: `最大回撤${dd.toFixed(1)}%` });
      sellScore += SIGNAL_WEIGHTS.MAX_DRAWDOWN;
    }
  }

  // ─── 4. 综合评分 ────────────────────────────────────────
  const netScore = buyScore - sellScore;

  let action, actionLabel, actionTone;
  if (netScore >= THRESHOLDS.BUY_STRONG) {
    action = 'buy';
    actionLabel = '关注买入/加仓';
    actionTone = 'up';
  } else if (netScore <= THRESHOLDS.SELL_STRONG) {
    action = 'sell';
    actionLabel = '考虑减仓/止盈';
    actionTone = 'down';
  } else if (netScore >= THRESHOLDS.BUY_WATCH) {
    action = 'watch_buy';
    actionLabel = '关注买入机会';
    actionTone = 'warn';
  } else if (netScore <= THRESHOLDS.SELL_WATCH) {
    action = 'watch_sell';
    actionLabel = '关注减仓时机';
    actionTone = 'warn';
  } else {
    action = 'hold';
    actionLabel = '观望';
    actionTone = 'neutral';
  }

  signals.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return {
    action,
    actionLabel,
    actionTone,
    netScore: Math.round(netScore * 100),
    buyScore: Math.round(buyScore * 100),
    sellScore: Math.round(sellScore * 100),
    signalCount: signals.length,
    signals: signals.slice(0, 5),
    updatedAt: Date.now(),
  };
}

// ─── 辅助函数 ──────────────────────────────────────────────

function calcMA(trend, period) {
  if (trend.length < period) return null;
  const slice = trend.slice(-period);
  const sum = slice.reduce((s, i) => s + i.y, 0);
  return sum / period;
}

function calcMATail(trend, period, tail) {
  if (trend.length < period + tail) return null;
  const slice = trend.slice(-period - tail, -tail);
  const sum = slice.reduce((s, i) => s + i.y, 0);
  return sum / period;
}

function calcRSI(trend, period) {
  if (trend.length < period + 1) return null;
  const changes = [];
  for (let i = trend.length - period; i < trend.length; i++) {
    const prev = trend[i - 1]?.y;
    const curr = trend[i]?.y;
    if (prev != null && curr != null) changes.push(curr - prev);
  }
  if (changes.length < period) return null;
  const gains = changes.filter(c => c > 0).reduce((s, c) => s + c, 0);
  const losses = changes.filter(c => c < 0).reduce((s, c) => s - c, 0);
  if (losses === 0) return gains > 0 ? 100 : 50;
  return 100 - (100 / (1 + gains / losses));
}

function calcConsecutiveDays(trend) {
  if (trend.length < 3) return null;
  let days = 0;
  let direction = 'up';
  for (let i = trend.length - 1; i >= 1; i--) {
    const diff = trend[i].y - trend[i - 1].y;
    if (diff > 0 && (days === 0 || direction === 'up')) {
      days++;
      direction = 'up';
    } else if (diff < 0 && (days === 0 || direction === 'down')) {
      days++;
      direction = 'down';
    } else break;
  }
  return days >= 2 ? { days, direction } : null;
}

function calcMaxDrawdown(trend) {
  if (trend.length < 2) return null;
  let peak = trend[0].y;
  let maxDD = 0;
  for (const item of trend) {
    if (item.y > peak) peak = item.y;
    const dd = ((peak - item.y) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/** 评估组合级别的信号汇总 */
export function evaluatePortfolio(fundSignals) {
  const buys = fundSignals.filter(s => s.action === 'buy');
  const sells = fundSignals.filter(s => s.action === 'sell');
  const watchBuys = fundSignals.filter(s => s.action === 'watch_buy');
  const watchSells = fundSignals.filter(s => s.action === 'watch_sell');

  return {
    buyCount: buys.length,
    sellCount: sells.length,
    watchBuyCount: watchBuys.length,
    watchSellCount: watchSells.length,
    totalSignals: fundSignals.length,
    hasAction: buys.length > 0 || sells.length > 0,
    topBuy: buys.slice(0, 3),
    topSell: sells.slice(0, 3),
    updatedAt: Date.now(),
  };
}

/** 生成基金经理级别的可读建议 */
export function generateManagerAdvice(signal, fund, position) {
  if (!signal) return {};
  const signalTexts = (signal.signals || []).map(s => s.name + (s.detail ? '(' + s.detail + ')' : ''));
  const buyTexts = (signal.buySignals || []).map(s => s.name + (s.detail ? '(' + s.detail + ')' : ''));
  const sellTexts = (signal.sellSignals || []).map(s => s.name + (s.detail ? '(' + s.detail + ')' : ''));
  
  // 生成总结
  let summary = '';
  if (signal.action === 'buy') {
    summary = '今天偏向买入。' + (buyTexts.slice(0, 2).join('；') || '技术面显示机会');
  } else if (signal.action === 'sell') {
    summary = '今天偏向卖出/减仓。' + (sellTexts.slice(0, 2).join('；') || '技术面显示风险');
  } else if (signal.action === 'watch_buy') {
    summary = '保持关注，有买入机会。' + (buyTexts.slice(0, 1).join('') || '');
  } else if (signal.action === 'watch_sell') {
    summary = '保持关注，有减仓信号。' + (sellTexts.slice(0, 1).join('') || '');
  } else {
    summary = '当前信号不明确，建议观望。';
  }
  
  // 仓位建议
  let positionAdvice = '';
  if (position && position.share > 0) {
    const nav = Number(fund?.dwjz || 0);
    const cost = position.cost || 0;
    if (nav > 0 && cost > 0) {
      const pnl = (nav - cost) / cost * 100;
      if (signal.action === 'buy') {
        positionAdvice = '当前可以分批加仓，控制节奏不要一次买满。';
      } else if (signal.action === 'sell') {
        if (pnl > 10) positionAdvice = '当前盈利尚可，可以考虑止盈一部分。';
        else if (pnl < -10) positionAdvice = '当前亏算较大，考虑止损控制风险。';
        else positionAdvice = '可以考虑减仓控制整体仓位。';
      } else if (Math.abs(pnl) < 5) {
        positionAdvice = '盈亏不大，不适合频繁操作，继续持有观察。';
      }
    }
  } else {
    if (signal.action === 'buy') positionAdvice = '轻仓试探，控制在计划仓位的30%以内。';
    else positionAdvice = '暂无持仓，观望为主。';
  }

  return {
    summary,
    positionAdvice,
    keySignals: signalTexts.slice(0, 5),
    buySignals: buyTexts,
    sellSignals: sellTexts,
  };
}

export default {
  evaluateFundSignal,
  evaluatePortfolio,
  generateManagerAdvice,
};
