import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');

const TZ = 'Asia/Shanghai';
const nowInTz = () => dayjs().tz(TZ);
const toTz = (input) => (input ? dayjs.tz(input, TZ) : nowInTz());

export const loadScript = (url) => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document.body) return resolve();
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    const cleanup = () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
    script.onload = () => {
      cleanup();
      resolve();
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('数据加载失败'));
    };
    document.body.appendChild(script);
  });
};

export const fetchFundNetValue = async (code, date) => {
  if (typeof window === 'undefined') return null;
  const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=1&sdate=${date}&edate=${date}`;
  try {
    await loadScript(url);
    if (window.apidata && window.apidata.content) {
      const content = window.apidata.content;
      if (content.includes('暂无数据')) return null;
      const rows = content.split('<tr>');
      for (const row of rows) {
        if (row.includes(`<td>${date}</td>`)) {
          const cells = row.match(/<td[^>]*>(.*?)<\/td>/g);
          if (cells && cells.length >= 2) {
            const valStr = cells[1].replace(/<[^>]+>/g, '');
            const val = parseFloat(valStr);
            return isNaN(val) ? null : val;
          }
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const fetchSmartFundNetValue = async (code, startDate) => {
  const today = nowInTz().startOf('day');
  let current = toTz(startDate).startOf('day');
  for (let i = 0; i < 30; i++) {
    if (current.isAfter(today)) break;
    const dateStr = current.format('YYYY-MM-DD');
    const val = await fetchFundNetValue(code, dateStr);
    if (val !== null) {
      return { date: dateStr, value: val };
    }
    current = current.add(1, 'day');
  }
  return null;
};

/**
 * 从腾讯分时估值接口获取实时估值(gsz)
 * 使用fetch直接调用(CORS友好)，无需JSONP
 * 返回: { gsz, gszzl, gztime, yesterdayDwjz } 或 null
 */
export const fetchGsZFromIntraday = async (code) => {
  try {
    const url = `https://web.ifzq.gtimg.cn/fund/newfund/fundSsgz/getSsgz?app=web&symbol=jj${code}&_=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const result = await response.json();
    if (result.code !== 0 || !result.data) return null;
    const { data, yesterdayDwjz } = result.data;
    if (!Array.isArray(data) || data.length < 2) return null;
    // 最新数据点: [time, est_nav, change_amount]
    const last = data[data.length - 1];
    // 分时图还没开始 (0930是第一笔, 0931第二笔...)
    // 用最新时刻的时间
    const timeStr = last[0]; // "1500" 表示15:00
    const gsz = last[1];
    const yesterday = parseFloat(yesterdayDwjz);
    if (!gsz || !yesterday || yesterday === 0) return null;
    const gszzl = ((gsz - yesterday) / yesterday) * 100;
    const gztime = `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
    return { gsz: gsz.toFixed(4), gszzl: gszzl.toFixed(2), gztime, yesterdayDwjz: yesterday, dataDate: result.data.date };
  } catch (e) {
    return null;
  }
};

export const fetchFundDataFallback = async (c) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }
  return new Promise(async (resolve, reject) => {
    const searchCallbackName = `SuggestData_fallback_${Date.now()}`;
    const searchUrl = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(c)}&callback=${searchCallbackName}&_=${Date.now()}`;
    let fundName = '';
    try {
      await new Promise((resSearch, rejSearch) => {
        window[searchCallbackName] = (data) => {
          if (data && data.Datas && data.Datas.length > 0) {
            const found = data.Datas.find(d => d.CODE === c);
            if (found) {
              fundName = found.NAME || found.SHORTNAME || '';
            }
          }
          delete window[searchCallbackName];
          resSearch();
        };
        const script = document.createElement('script');
        script.src = searchUrl;
        script.async = true;
        script.onload = () => {
          if (document.body.contains(script)) document.body.removeChild(script);
        };
        script.onerror = () => {
          if (document.body.contains(script)) document.body.removeChild(script);
          delete window[searchCallbackName];
          rejSearch(new Error('搜索接口失败'));
        };
        document.body.appendChild(script);
        setTimeout(() => {
          if (window[searchCallbackName]) {
            delete window[searchCallbackName];
            resSearch();
          }
        }, 3000);
      });
    } catch (e) {
    }
    const tUrl = `https://qt.gtimg.cn/q=jj${c}`;
    const tScript = document.createElement('script');
    tScript.src = tUrl;
    tScript.onload = () => {
      const v = window[`v_jj${c}`];
      if (v && v.length > 5) {
        const p = v.split('~');
        const name = fundName || p[1] || `未知基金(${c})`;
        const dwjz = p[5];
        const zzl = parseFloat(p[7]);
        const jzrq = p[8] ? p[8].slice(0, 10) : '';
        if (dwjz) {
          resolve({
            code: c,
            name: name,
            dwjz: dwjz,
            gsz: null,
            gztime: null,
            jzrq: jzrq,
            gszzl: null,
            zzl: !isNaN(zzl) ? zzl : null,
            noValuation: true,
            holdings: []
          });
        } else {
          reject(new Error('未能获取到基金数据'));
        }
      } else {
        reject(new Error('未能获取到基金数据'));
      }
      if (document.body.contains(tScript)) document.body.removeChild(tScript);
    };
    tScript.onerror = () => {
      if (document.body.contains(tScript)) document.body.removeChild(tScript);
      reject(new Error('基金数据加载失败'));
    };
    document.body.appendChild(tScript);
  });
};

export const fetchFundData = async (c) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }

  const result = { code: c, name: '', dwjz: '', gsz: null, gztime: null, jzrq: '', gszzl: null, zzl: null, holdings: [], historyTrend: [], yesterdayChange: null, dataSource: '', dataDate: '' };

  // ─── 第一步: 并行请求多个数据源 ──────────────────────────────────
  // 同时启动: 天天基金(gsz+gszzl+gztime) + 腾讯(netValue) + 分时估值(gsz) + 持仓 + 趋势
  const gzPromise = new Promise((resolveGz) => {
    const gzUrl = 'https://fundgz.1234567.com.cn/js/' + c + '.js?rt=' + Date.now();
    const originalJsonpgz = window.jsonpgz;
    let resolved = false;
    const scriptGz = document.createElement('script');
    scriptGz.src = gzUrl;
    window.jsonpgz = (json) => {
      if (resolved) return;
      resolved = true;
      window.jsonpgz = originalJsonpgz;
      if (json && typeof json === 'object' && json.gsz) {
        resolveGz({
          gsz: json.gsz,
          gszzl: Number(json.gszzl),
          gztime: json.gztime,
          dwjz: json.dwjz,
          jzrq: json.jzrq,
          name: json.name,
          source: 'fundgz',
        });
      } else {
        resolveGz(null);
      }
    };
    scriptGz.onerror = () => {
      if (!resolved) { resolved = true; window.jsonpgz = originalJsonpgz; resolveGz(null); }
    };
    if (document.body) document.body.appendChild(scriptGz);
    // 超时5秒
    setTimeout(() => {
      if (!resolved) { resolved = true; window.jsonpgz = originalJsonpgz; resolveGz(null); }
    }, 5000);
  });

  // CORS分时估值接口（腾讯，非常稳定）
  const intradayPromise = fetchGsZFromIntraday(c).catch(() => null);

  // 腾讯净值数据
  const tencentPromise = new Promise((resolveT) => {
    const tUrl = 'https://qt.gtimg.cn/q=jj' + c;
    const tScript = document.createElement('script');
    tScript.src = tUrl;
    tScript.onload = () => {
      const v = window['v_jj' + c];
      if (v) {
        const p = v.split('~');
        resolveT({
          dwjz: p[5],
          zzl: parseFloat(p[7]),
          jzrq: p[8] ? p[8].slice(0, 10) : '',
          name: p[1] || '',
        });
      } else {
        resolveT(null);
      }
      if (document.body && document.body.contains(tScript)) document.body.removeChild(tScript);
    };
    tScript.onerror = () => {
      if (document.body && document.body.contains(tScript)) document.body.removeChild(tScript);
      resolveT(null);
    };
    if (document.body) document.body.appendChild(tScript);
  });

  // 持仓数据
  const holdingsPromise = new Promise((resolveH) => {
    const holdingsUrl = 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=' + c + '&topline=10&year=&month=&_=' + Date.now();
    loadScript(holdingsUrl).then(async () => {
      let holdings = [];
      const html = window.apidata?.content || '';
      const headerRow = (html.match(/<thead[\s\S]*?<tr[\s\S]*?<\/tr>[\s\S]*?<\/thead>/i) || [])[0] || '';
      const headerCells = (headerRow.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi) || []).map(th => th.replace(/<[^>]*>/g, '').trim());
      let idxCode = -1, idxName = -1, idxWeight = -1;
      headerCells.forEach((h, i) => {
        const t = h.replace(/\s+/g, '');
        if (idxCode < 0 && (t.includes('股票代码') || t.includes('证券代码'))) idxCode = i;
        if (idxName < 0 && (t.includes('股票名称') || t.includes('证券名称'))) idxName = i;
        if (idxWeight < 0 && (t.includes('占净值比例') || t.includes('占比'))) idxWeight = i;
      });
      const rows = html.match(/<tbody[\s\S]*?<\/tbody>/i) || [];
      const dataRows = rows.length ? rows[0].match(/<tr[\s\S]*?<\/tr>/gi) || [] : html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const r of dataRows) {
        const tds = (r.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || []).map(td => td.replace(/<[^>]*>/g, '').trim());
        if (!tds.length) continue;
        let code = '';
        let name = '';
        let weight = '';
        if (idxCode >= 0 && tds[idxCode]) {
          const m = tds[idxCode].match(/(\d{6})/);
          code = m ? m[1] : tds[idxCode];
        } else {
          const codeIdx = tds.findIndex(txt => /^\d{6}$/.test(txt));
          if (codeIdx >= 0) code = tds[codeIdx];
        }
        if (idxName >= 0 && tds[idxName]) {
          name = tds[idxName];
        } else if (code) {
          const i = tds.findIndex(txt => txt && txt !== code && !/%$/.test(txt));
          name = i >= 0 ? tds[i] : '';
        }
        if (idxWeight >= 0 && tds[idxWeight]) {
          const wm = tds[idxWeight].match(/([\d.]+)\s*%/);
          weight = wm ? wm[1] + '%' : tds[idxWeight];
        } else {
          const wIdx = tds.findIndex(txt => /\d+(?:\\.\d+)?\s*%/.test(txt));
          weight = wIdx >= 0 ? (tds[wIdx].match(/([\d.]+)\s*%/)?.[1] + '%') : '';
        }
        if (code || name || weight) {
          holdings.push({ code, name, weight, change: null });
        }
      }
      holdings = holdings.slice(0, 10);
      // 获取持仓股实时行情
      const needQuotes = holdings.filter(h => /^\d{6}$/.test(h.code) || /^\d{5}$/.test(h.code));
      if (needQuotes.length) {
        try {
          const tencentCodes = needQuotes.map(h => {
            const cd = String(h.code || '');
            if (/^\d{6}$/.test(cd)) {
              const pfx = cd.startsWith('6') || cd.startsWith('9') ? 'sh' : ((cd.startsWith('4') || cd.startsWith('8')) ? 'bj' : 'sz');
              return 's_' + pfx + cd;
            }
            if (/^\d{5}$/.test(cd)) return 's_hk' + cd;
            return null;
          }).filter(Boolean).join(',');
          if (tencentCodes) {
            const quoteUrl = 'https://qt.gtimg.cn/q=' + tencentCodes;
            await new Promise((resQuote) => {
              const scriptQuote = document.createElement('script');
              scriptQuote.src = quoteUrl;
              scriptQuote.onload = () => {
                needQuotes.forEach(h => {
                  const cd = String(h.code || '');
                  let varName = '';
                  if (/^\d{6}$/.test(cd)) {
                    const pfx = cd.startsWith('6') || cd.startsWith('9') ? 'sh' : ((cd.startsWith('4') || cd.startsWith('8')) ? 'bj' : 'sz');
                    varName = 'v_s_' + pfx + cd;
                  } else if (/^\d{5}$/.test(cd)) {
                    varName = 'v_s_hk' + cd;
                  } else return;
                  const dataStr = window[varName];
                  if (dataStr) {
                    const parts = dataStr.split('~');
                    if (parts.length > 5) h.change = parseFloat(parts[5]);
                  }
                });
                if (document.body && document.body.contains(scriptQuote)) document.body.removeChild(scriptQuote);
                resQuote();
              };
              scriptQuote.onerror = () => {
                if (document.body && document.body.contains(scriptQuote)) document.body.removeChild(scriptQuote);
                resQuote();
              };
              if (document.body) document.body.appendChild(scriptQuote);
            });
          }
        } catch (e) {}
      }
      resolveH(holdings);
    }).catch(() => resolveH([]));
  });

  // 历史净值趋势
  const trendPromise = new Promise(async (resolveTr) => {
    try {
      const pingUrl = 'https://fund.eastmoney.com/pingzhongdata/' + c + '.js?v=' + Date.now();
      await loadScript(pingUrl);
      const trend = Array.isArray(window.Data_netWorthTrend) ? window.Data_netWorthTrend : [];
      let historyTrend = [];
      let yesterdayChange = null;
      if (trend.length > 0) {
        const sliced = trend.slice(-90);
        historyTrend = sliced.map(item => ({ x: item.x, y: item.y, equityReturn: item.equityReturn }));
        const last = sliced[sliced.length - 2];
        if (last && typeof last.equityReturn === 'number') yesterdayChange = last.equityReturn;
      }
      resolveTr({ historyTrend, yesterdayChange });
    } catch (e) {
      resolveTr({ historyTrend: [], yesterdayChange: null });
    }
  });

  // ─── 第二步: 等待所有请求返回 ────────────────────────────────────
  const [gzData, intradayData, tencentData, holdings, trendData] = await Promise.all([
    gzPromise, intradayPromise, tencentPromise, holdingsPromise, trendPromise
  ]);

  // ─── 第三步: 数据融合 ────────────────────────────────────────────
  // gsz优先级: fundgz > 分时估值CORS
  let gsz = null, gszzl = null, gztime = null, dataSource = '';
  if (gzData && gzData.gsz) {
    gsz = gzData.gsz;
    gszzl = gzData.gszzl;
    gztime = gzData.gztime;
    dataSource = 'fundgz';
  } else if (intradayData && intradayData.gsz) {
    gsz = intradayData.gsz;
    gszzl = intradayData.gszzl;
    gztime = intradayData.gztime;
    dataSource = 'intraday';
  }

  // dwjz优先级: fundgz > 腾讯
  let dwjz = null, jzrq = null;
  if (gzData && gzData.dwjz) {
    dwjz = gzData.dwjz;
    jzrq = gzData.jzrq;
  }
  if (tencentData && tencentData.dwjz) {
    // 如果fundgz有数据且日期更新，使用fundgz的
    // 否则使用腾讯的（更可靠）
    if (!dwjz || (tencentData.jzrq && (!jzrq || tencentData.jzrq >= jzrq))) {
      dwjz = tencentData.dwjz;
      jzrq = tencentData.jzrq;
    }
  }

  const name = (gzData && gzData.name) || (tencentData && tencentData.name) || '';
  const zzl = tencentData ? tencentData.zzl : null;
  const { historyTrend, yesterdayChange } = trendData || {};

  return {
    code: c,
    name: name,
    dwjz: dwjz || '',
    gsz: gsz,
    gztime: gztime,
    jzrq: jzrq || '',
    gszzl: gszzl,
    zzl: zzl,
    holdings: holdings || [],
    historyTrend: historyTrend || [],
    yesterdayChange: yesterdayChange,
    dataSource: dataSource,
  };
}
export const searchFunds = async (val) => {
  if (!val.trim()) return [];
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];
  const callbackName = `SuggestData_${Date.now()}`;
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(val)}&callback=${callbackName}&_=${Date.now()}`;
  return new Promise((resolve, reject) => {
    window[callbackName] = (data) => {
      let results = [];
      if (data && data.Datas) {
        results = data.Datas.filter(d =>
          d.CATEGORY === 700 ||
          d.CATEGORY === '700' ||
          d.CATEGORYDESC === '基金'
        );
      }
      delete window[callbackName];
      resolve(results);
    };
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
    script.onerror = () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      delete window[callbackName];
      reject(new Error('搜索请求失败'));
    };
    document.body.appendChild(script);
  });
};

export const fetchShanghaiIndexDate = async () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://qt.gtimg.cn/q=sh000001&_t=${Date.now()}`;
    script.onload = () => {
      const data = window.v_sh000001;
      let dateStr = null;
      if (data) {
        const parts = data.split('~');
        if (parts.length > 30) {
          dateStr = parts[30].slice(0, 8);
        }
      }
      if (document.body.contains(script)) document.body.removeChild(script);
      resolve(dateStr);
    };
    script.onerror = () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      reject(new Error('指数数据加载失败'));
    };
    document.body.appendChild(script);
  });
};

export const fetchLatestRelease = async () => {
  // 暂时禁用版本检查，避免控制台 404 报错
  return null;
  /*
  try {
    const res = await fetch('https://api.github.com/repos/zhengshengning/fund-baby/releases/latest');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tagName: data.tag_name,
      body: data.body || ''
    };
  } catch (e) {
    return null;
  }
  */
};

export const submitFeedback = async (formData) => {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    body: formData
  });
  return response.json();
};

export const fetchIntradayData = async (code) => {
    try {
        // 使用腾讯财经接口，支持 CORS，无需后端代理
        const url = `https://web.ifzq.gtimg.cn/fund/newfund/fundSsgz/getSsgz?app=web&symbol=jj${code}&_=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const result = await response.json();
        if (result.code === 0 && result.data && Array.isArray(result.data.data)) {
            const { data: list, yesterdayDwjz } = result.data;
            const yDwjz = parseFloat(yesterdayDwjz);

            if (!yDwjz) return null;

            return list.map(item => {
                // item: ["0930", 1.1846, -0.0036] (时间, 估值, 涨跌额)
                const timeStr = item[0];
                const value = Number(item[1]);

                // 格式化时间 "0930" -> "09:30"
                const formattedTime = `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;

                // 计算涨跌幅
                const growth = ((value - yDwjz) / yDwjz * 100).toFixed(2);

                return {
                    time: formattedTime,
                    value: value,
                    growth: growth
                };
            });
        }
        return null;
    } catch (e) {
        console.error('获取分时数据失败', code, e);
        return null;
    }
};
