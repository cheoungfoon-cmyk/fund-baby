/**
 * 本地基金分析引擎
 * 
 * 从已有的趋势数据(netWorthTrend)计算各种分析指标
 * 不依赖外部 AI API，可独立运行
 */

/**
 * 计算一段时间内的收益率
 * @param {Array} trendData - [{ x: timestamp_ms, y: nav_value, equityReturn: daily_change_pct }]
 * @param {number} days - 回看天数
 * @returns {number|null} 收益率百分比
 */
function calcReturn(trendData, days) {
  if (!Array.isArray(trendData) || trendData.length < 2) return null;
  const data = trendData.slice(-days);
  if (data.length < 2) return null;
  const first = data[0].y;
  const last = data[data.length - 1].y;
  if (!first || !last) return null;
  return ((last - first) / first) * 100;
}

/**
 * 计算年化波动率（基于日收益率的标准差）
 * @param {Array} trendData - [{ x, y, equityReturn }]
 * @returns {number|null} 年化波动率百分比
 */
function calcVolatility(trendData) {
  if (!Array.isArray(trendData) || trendData.length < 5) return null;
  const returns = [];
  // 使用 equityReturn 字段（日涨跌幅）
  for (let i = 1; i < trendData.length; i++) {
    const r = trendData[i].equityReturn;
    if (r != null && Number.isFinite(r)) {
      returns.push(r); // 已经是百分比
    }
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance);
  // 年化：日波动率 * sqrt(245) (约 245 个交易日)
  return dailyStd * Math.sqrt(245);
}

/**
 * 计算最大回撤
 * @param {Array} trendData - [{ x, y }]
 * @returns {number|null} 最大回撤百分比（正数）
 */
function calcMaxDrawdown(trendData) {
  if (!Array.isArray(trendData) || trendData.length < 2) return null;
  let peak = trendData[0].y;
  let maxDD = 0;
  for (const item of trendData) {
    if (item.y > peak) peak = item.y;
    const dd = ((peak - item.y) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * 计算夏普比率（简化版，假设无风险利率为 2%）
 * @param {Array} trendData
 * @returns {number|null}
 */
function calcSharpe(trendData) {
  if (!Array.isArray(trendData) || trendData.length < 20) return null;
  const returns = [];
  for (let i = 1; i < trendData.length; i++) {
    const r = trendData[i].equityReturn;
    if (r != null && Number.isFinite(r)) {
      returns.push(r);
    }
  }
  if (returns.length < 10) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  // 日化超额收益 * sqrt(245)
  const dailyExcess = (mean / 100) - (0.02 / 245);
  return (dailyExcess / (std / 100)) * Math.sqrt(245);
}

/**
 * 计算 RSI (相对强弱指标)
 * @param {Array} trendData
 * @param {number} period - 周期，默认 14
 * @returns {number|null}
 */
function calcRSI(trendData, period = 14) {
  if (!Array.isArray(trendData) || trendData.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i <= period; i++) {
    const idx = trendData.length - i;
    const prev = trendData[idx - 1]?.y;
    const curr = trendData[idx]?.y;
    if (prev != null && curr != null) {
      changes.push(curr - prev);
    }
  }
  if (changes.length < period) return null;
  const gains = changes.filter(c => c > 0).reduce((s, c) => s + c, 0);
  const losses = changes.filter(c => c < 0).reduce((s, c) => s - c, 0);
  if (losses === 0) return gains > 0 ? 100 : 50;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

/**
 * 计算移动平均线
 * @param {Array} trendData
 * @param {number} period - 周期
 * @returns {number|null} 当前 MA 值
 */
function calcMA(trendData, period) {
  if (!Array.isArray(trendData) || trendData.length < period) return null;
  const slice = trendData.slice(-period);
  const sum = slice.reduce((s, item) => s + item.y, 0);
  return sum / period;
}

/**
 * 趋势判断：均线多头/空头排列
 * @param {Array} trendData
 * @returns {{ signal: string, strength: string, description: string }}
 */
function analyzeTrend(trendData) {
  if (!Array.isArray(trendData) || trendData.length < 60) {
    return { signal: '数据不足', strength: 'neutral', description: '需要至少60个交易日数据' };
  }
  const ma5 = calcMA(trendData, 5);
  const ma10 = calcMA(trendData, 10);
  const ma20 = calcMA(trendData, 20);
  const ma60 = calcMA(trendData, 60);
  const current = trendData[trendData.length - 1]?.y;

  if (!ma5 || !ma10 || !ma20 || !ma60 || !current) {
    return { signal: '计算中', strength: 'neutral', description: '' };
  }

  // 多头排列：ma5 > ma10 > ma20 > ma60 且价格在 ma5 之上
  const bullish = ma5 > ma10 && ma10 > ma20 && ma20 > ma60 && current > ma5;
  const bearish = ma5 < ma10 && ma10 < ma20 && ma20 < ma60 && current < ma5;

  if (bullish) {
    return {
      signal: '多头趋势',
      strength: 'up',
      description: `均线多头排列 (MA5=${ma5.toFixed(4)} > MA10=${ma10.toFixed(4)} > MA20=${ma20.toFixed(4)})`
    };
  }
  if (bearish) {
    return {
      signal: '空头趋势',
      strength: 'down',
      description: `均线空头排列 (MA5=${ma5.toFixed(4)} < MA10=${ma10.toFixed(4)} < MA20=${ma20.toFixed(4)})`
    };
  }

  // 检测金叉/死叉
  const prevMa5 = calcMA(trendData.slice(0, -1), 5);
  const prevMa10 = calcMA(trendData.slice(0, -1), 10);
  const prevMa20 = calcMA(trendData.slice(0, -1), 20);

  if (prevMa5 && prevMa10) {
    if (prevMa5 <= prevMa10 && ma5 > ma10) {
      return { signal: '金叉信号', strength: 'up', description: '5日均线上穿10日均线，短期看涨' };
    }
    if (prevMa5 >= prevMa10 && ma5 < ma10) {
      return { signal: '死叉信号', strength: 'down', description: '5日均线下穿10日均线，短期看跌' };
    }
  }

  // 价格与均线关系
  if (current > ma20) {
    return { signal: '偏多头', strength: 'up', description: `价格在MA20(${ma20.toFixed(4)})之上` };
  }
  if (current < ma20) {
    return { signal: '偏空头', strength: 'down', description: `价格在MA20(${ma20.toFixed(4)})之下` };
  }

  return { signal: '震荡整理', strength: 'neutral', description: '均线交织，方向不明' };
}

/**
 * RSI 信号判断
 * @param {number} rsi
 * @returns {{ signal: string, strength: string }}
 */
function analyzeRSI(rsi) {
  if (rsi == null) return { signal: '--', strength: 'neutral' };
  if (rsi >= 70) return { signal: '超买', strength: 'down' };
  if (rsi <= 30) return { signal: '超卖', strength: 'up' };
  if (rsi >= 60) return { signal: '偏强', strength: 'up' };
  if (rsi <= 40) return { signal: '偏弱', strength: 'down' };
  return { signal: '中性', strength: 'neutral' };
}

/**
 * 根据回撤数据生成风险评级
 * @param {number} maxDrawdown
 * @param {number} volatility
 * @returns {{ level: string, score: number }}
 */
function calcRiskLevel(maxDrawdown, volatility) {
  if (maxDrawdown == null && volatility == null) {
    return { level: '--', score: 0 };
  }

  let score = 0;
  // 最大回撤评分 (0-50)
  if (maxDrawdown != null) {
    if (maxDrawdown > 40) score += 45;
    else if (maxDrawdown > 25) score += 35;
    else if (maxDrawdown > 15) score += 25;
    else if (maxDrawdown > 8) score += 15;
    else score += 5;
  }
  // 波动率评分 (0-50)
  if (volatility != null) {
    if (volatility > 30) score += 45;
    else if (volatility > 20) score += 35;
    else if (volatility > 15) score += 25;
    else if (volatility > 10) score += 15;
    else score += 5;
  }

  let level = '低风险';
  if (score >= 70) level = '高风险';
  else if (score >= 50) level = '中高风险';
  else if (score >= 30) level = '中风险';
  else if (score >= 15) level = '中低风险';

  return { level, score };
}

/**
 * 综合本地分析
 * @param {Array} trendData - 历史净值趋势
 * @param {Object} extra - 额外信息 { fund, metrics, holdings }
 * @returns {Object} 分析结果
 */
export function analyzeFund(trendData, extra = {}) {
  const { fund = {}, metrics = {}, holdings = [] } = extra;

  // 各周期收益率
  const return_1w = calcReturn(trendData, 5);
  const return_1m = calcReturn(trendData, 21);
  const return_3m = calcReturn(trendData, 63);
  const return_6m = calcReturn(trendData, 126);
  const return_1y = calcReturn(trendData, 250);

  // 风险指标
  const volatility = calcVolatility(trendData);
  const maxDrawdown = calcMaxDrawdown(trendData);
  const sharpe = calcSharpe(trendData);

  // 技术指标
  const rsi = calcRSI(trendData);
  const rsiAnalysis = analyzeRSI(rsi);
  const trend = analyzeTrend(trendData);

  // 风险评级
  const risk = calcRiskLevel(maxDrawdown, volatility);

  // 综合判断
  const signals = [];

  // 趋势信号
  if (trend.strength === 'up') signals.push({ text: trend.signal, positive: true });
  else if (trend.strength === 'down') signals.push({ text: trend.signal, positive: false });
  else signals.push({ text: trend.signal, positive: null });

  // RSI 信号
  if (rsiAnalysis.strength === 'up') signals.push({ text: `RSI ${rsiAnalysis.signal}`, positive: true });
  else if (rsiAnalysis.strength === 'down') signals.push({ text: `RSI ${rsiAnalysis.signal}`, positive: false });
  else signals.push({ text: `RSI ${rsiAnalysis.signal}`, positive: null });

  // 近期收益信号
  if (return_1m != null && return_3m != null) {
    if (return_1m > 0 && return_3m > 0) {
      signals.push({ text: '近期收益为正', positive: true });
    } else if (return_1m < -5 && return_3m < -5) {
      signals.push({ text: '近期收益持续为负', positive: false });
    }
  }

  // 持仓集中度分析
  let holdingConcentration = null;
  if (Array.isArray(holdings) && holdings.length > 0) {
    const totalWeight = holdings.reduce((sum, h) => {
      const w = parseFloat(h.weight);
      return sum + (isNaN(w) ? 0 : w);
    }, 0);
    if (totalWeight > 0) {
      holdingConcentration = totalWeight;
      if (totalWeight > 60) {
        signals.push({ text: '持仓集中度较高', positive: null });
      } else if (totalWeight < 20) {
        signals.push({ text: '持仓较为分散', positive: true });
      }
    }
  }

  // 生成综合结论
  const positiveCount = signals.filter(s => s.positive === true).length;
  const negativeCount = signals.filter(s => s.positive === false).length;
  const totalSignals = signals.filter(s => s.positive != null).length;

  let action = 'hold';
  let actionLabel = '观望';
  let confidence = 0;
  let headline = '';

  if (totalSignals > 0) {
    const ratio = positiveCount / totalSignals;
    confidence = Math.round(ratio * 100);
    if (ratio > 0.6 && trend.strength === 'up') {
      action = 'buy';
      actionLabel = '可关注';
      headline = trend.signal === '金叉信号'
        ? '技术指标显示短期买入信号'
        : '整体技术面偏积极，可适度关注';
    } else if (ratio < 0.3) {
      action = 'reduce';
      actionLabel = '需谨慎';
      headline = trend.signal === '死叉信号'
        ? '技术指标显示短期卖出信号'
        : '技术面偏弱，建议观望为主';
    } else {
      headline = '各项指标中性，建议持续观察';
    }
  } else {
    headline = '数据不足，无法形成可靠结论';
  }

  return {
    summary: {
      returns: { "1周": return_1w, "1月": return_1m, "3月": return_3m, "6月": return_6m, "1年": return_1y },
      volatility: volatility != null ? volatility.toFixed(2) : null,
      maxDrawdown: maxDrawdown != null ? maxDrawdown.toFixed(2) : null,
      sharpe: sharpe != null ? sharpe.toFixed(2) : null,
    },
    technical: {
      rsi: rsi != null ? rsi.toFixed(1) : null,
      rsiSignal: rsiAnalysis.signal,
      trendSignal: trend.signal,
      trendDescription: trend.description,
      ma5: calcMA(trendData, 5),
      ma10: calcMA(trendData, 10),
      ma20: calcMA(trendData, 20),
      ma60: calcMA(trendData, 60),
    },
    risk: {
      level: risk.level,
      score: risk.score,
      maxDrawdown: maxDrawdown,
      volatility: volatility,
    },
    signals,
    finalDecision: {
      action,
      action_label: actionLabel,
      headline,
      confidence: `${confidence}%`,
      summary: signals.length > 0
        ? `基于${signals.length}个信号指标的综合分析：${positiveCount}个积极信号，${negativeCount}个谨慎信号`
        : '暂无足够数据形成分析结论',
      why: signals.slice(0, 3).map(s => s.text),
    },
    holdingConcentration,
    isLocal: true,
  };
}

/**
 * 计算两只基金的相关性
 * @param {Array} trendA - 基金A趋势数据
 * @param {Array} trendB - 基金B趋势数据
 * @returns {number|null} 相关系数 (-1 到 1)
 */
export function calcCorrelation(trendA, trendB) {
  if (!Array.isArray(trendA) || !Array.isArray(trendB) || trendA.length < 10 || trendB.length < 10) {
    return null;
  }

  // 按时间戳对齐数据
  const mapA = new Map(trendA.map(d => [d.x, d.equityReturn]));
  const mapB = new Map(trendB.map(d => [d.x, d.equityReturn]));

  const pairs = [];
  for (const [ts, ra] of mapA) {
    if (ra == null || !Number.isFinite(ra)) continue;
    const rb = mapB.get(ts);
    if (rb == null || !Number.isFinite(rb)) continue;
    pairs.push([ra, rb]);
  }

  if (pairs.length < 10) return null;

  const n = pairs.length;
  const sumA = pairs.reduce((s, p) => s + p[0], 0);
  const sumB = pairs.reduce((s, p) => s + p[1], 0);
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0, varA = 0, varB = 0;
  for (const [a, b] of pairs) {
    const da = a - meanA;
    const db = b - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return null;
  return cov / denom;
}

/**
 * 计算组合风险（基于权重和相关性的简化版）
 * @param {Array} funds - [{ trend, weight }]
 * @returns {Object} 组合风险分析
 */
export function calcPortfolioRisk(funds) {
  if (!Array.isArray(funds) || funds.length < 1) return null;

  const validFunds = funds.filter(f => Array.isArray(f.trend) && f.trend.length > 10);
  if (validFunds.length < 1) return null;

  // 每个基金的波动率
  const vols = validFunds.map(f => ({
    fund: f,
    vol: calcVolatility(f.trend),
    weight: f.weight || 0,
  }));

  const totalWeight = vols.reduce((s, v) => s + v.weight, 0);

  // 组合波动率（简化：假设等权重下考虑平均相关性）
  let avgCorr = 0;
  let corrCount = 0;
  for (let i = 0; i < validFunds.length; i++) {
    for (let j = i + 1; j < validFunds.length; j++) {
      const corr = calcCorrelation(validFunds[i].trend, validFunds[j].trend);
      if (corr != null) {
        avgCorr += corr;
        corrCount++;
      }
    }
  }
  avgCorr = corrCount > 0 ? avgCorr / corrCount : 0;

  // 简单组合波动率估算
  let portfolioVol = 0;
  if (validFunds.length === 1) {
    portfolioVol = vols[0].vol || 0;
  } else if (totalWeight > 0) {
    let variance = 0;
    for (let i = 0; i < vols.length; i++) {
      for (let j = 0; j < vols.length; j++) {
        const wi = vols[i].weight / totalWeight;
        const wj = vols[j].weight / totalWeight;
        const vi = vols[i].vol || 0;
        const vj = vols[j].vol || 0;
        const corr = i === j ? 1 : avgCorr;
        variance += wi * wj * vi * vj * corr;
      }
    }
    portfolioVol = Math.sqrt(variance);
  }

  return {
    fundCount: validFunds.length,
    portfolioVolatility: portfolioVol,
    averageVolatility: vols.reduce((s, v) => s + (v.vol || 0), 0) / vols.length,
    averageCorrelation: avgCorr,
    diversificationScore: avgCorr < 0.3 ? '高' : avgCorr < 0.6 ? '中' : '低',
    funds: vols.map(v => ({
      weight: v.weight,
      volatility: v.vol,
    })),
  };
}

export default {
  analyzeFund,
  calcCorrelation,
  calcPortfolioRisk,
  calcReturn,
  calcVolatility,
  calcMaxDrawdown,
  calcSharpe,
  calcRSI,
  calcMA,
  analyzeTrend,
  analyzeRSI,
  calcRiskLevel,
};
