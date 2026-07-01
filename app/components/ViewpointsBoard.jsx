'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Storage ────────────────────────────────────────────────────────
const STORAGE_KEY = 'vp_board_data';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { bloggers: [], viewpoints: [] };
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

const PLATFORM_OPTIONS = [
  { value: 'douyin', label: '抖音' },
  { value: 'bilibili', label: 'B站' },
  { value: 'weibo', label: '微博' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'xueqiu', label: '雪球' },
  { value: 'other', label: '其他' },
];

const SENTIMENT_OPTIONS = [
  { value: 'bullish', label: '看好', color: '#22c55e' },
  { value: 'neutral', label: '中性', color: '#eab308' },
  { value: 'bearish', label: '看空', color: '#ef4444' },
];

function platformLabel(v) {
  return PLATFORM_OPTIONS.find(o => o.value === v)?.label || v || '其他';
}

function sentimentLabel(v) {
  return SENTIMENT_OPTIONS.find(o => o.value === v)?.label || v || '中性';
}

function sentimentColor(v) {
  return SENTIMENT_OPTIONS.find(o => o.value === v)?.color || '#999';
}

// ─── Blogger Manager ────────────────────────────────────────────────
function BloggerForm({ onSave, initial }) {
  const [name, setName] = useState(initial?.name || '');
  const [platform, setPlatform] = useState(initial?.platform || 'douyin');
  const [handle, setHandle] = useState(initial?.handle || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('请输入博主名称'); return; }
    onSave({ name: name.trim(), platform, handle: handle.trim(), notes: notes.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="vp-form">
      <div className="vp-form-grid">
        <div className="vp-form-group">
          <label>博主名称</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="如：某总舵主、某教授" required />
        </div>
        <div className="vp-form-group">
          <label>平台</label>
          <select className="input" value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="vp-form-group">
          <label>平台ID/链接</label>
          <input className="input" value={handle} onChange={e => setHandle(e.target.value)} placeholder="抖音号/主页链接" />
        </div>
        <div className="vp-form-group vp-form-full">
          <label>备注</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="个人简介或关注原因" />
        </div>
      </div>
      {error && <p className="vp-error">{error}</p>}
      <div className="vp-form-actions">
        <button className="button" type="submit">{initial ? '更新' : '添加博主'}</button>
      </div>
    </form>
  );
}

function BloggerCard({ blogger, viewpointCount, onEdit, onDelete, onSelect, active }) {
  return (
    <div className={`vp-blogger-card ${active ? 'vp-active' : ''}`} onClick={() => onSelect(blogger)}>
      <div className="vp-blogger-avatar">
        {blogger.name.slice(0, 1)}
      </div>
      <div className="vp-blogger-info">
        <strong>{blogger.name}</strong>
        <span className="muted">
          <span className="vp-platform-tag">{platformLabel(blogger.platform)}</span>
          {blogger.handle && <span> · {blogger.handle}</span>}
        </span>
        <span className="muted" style={{ fontSize: '11px' }}>{viewpointCount}条观点</span>
      </div>
      <div className="vp-blogger-actions">
        <button className="vp-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(blogger); }} title="编辑">✎</button>
        <button className="vp-icon-btn vp-danger" onClick={(e) => { e.stopPropagation(); onDelete(blogger.id); }} title="删除">✕</button>
      </div>
    </div>
  );
}

// ─── Viewpoint Entry ────────────────────────────────────────────────
function ViewpointForm({ bloggers, onSave, initial }) {
  const [bloggerId, setBloggerId] = useState(initial?.bloggerId || (bloggers[0]?.id || ''));
  const [date, setDate] = useState(initial?.date || fmtDate(new Date()));
  const [title, setTitle] = useState(initial?.title || '');
  const [summary, setSummary] = useState(initial?.summary || '');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [sentiment, setSentiment] = useState(initial?.sentiment || 'neutral');
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!bloggerId) { setError('请选择博主'); return; }
    if (!summary.trim()) { setError('请输入观点内容'); return; }
    onSave({
      bloggerId, date, title: title.trim(), summary: summary.trim(),
      videoUrl: videoUrl.trim(), sentiment,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  // Extract video ID for preview
  const getVideoId = () => {
    if (!videoUrl) return null;
    const m = videoUrl.match(/v\.douyin\.com\/(\w+)/) || videoUrl.match(/douyin\.com\/video\/(\d+)/) || videoUrl.match(/bilibili\.com\/video\/(\w+)/);
    return m ? m[1] : null;
  };

  return (
    <form onSubmit={handleSubmit} className="vp-form">
      <div className="vp-form-grid">
        <div className="vp-form-group">
          <label>博主</label>
          <select className="input" value={bloggerId} onChange={e => setBloggerId(e.target.value)} required>
            <option value="">选择博主</option>
            {bloggers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="vp-form-group">
          <label>日期</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="vp-form-group">
          <label>观点标签</label>
          <select className="input" value={sentiment} onChange={e => setSentiment(e.target.value)}>
            {SENTIMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="vp-form-group">
          <label>分类标签</label>
          <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="大盘,新能源,策略(逗号分隔)" />
        </div>
        <div className="vp-form-group vp-form-full">
          <label>标题</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="观点标题（选填）" />
        </div>
        <div className="vp-form-group vp-form-full">
          <label>视频链接</label>
          <input className="input" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="抖音/B站/微博视频链接（选填，点击可跳转观看）" />
          {getVideoId() && (
            <p className="vp-hint">已识别视频 ID: {getVideoId()}（点击下方链接在新窗口打开）</p>
          )}
        </div>
        <div className="vp-form-group vp-form-full">
          <label>观点内容</label>
          <textarea className="input vp-textarea" value={summary} onChange={e => setSummary(e.target.value)} placeholder="记录博主的核心观点、关键论据和数据引用..." rows={4} required />
        </div>
      </div>
      {error && <p className="vp-error">{error}</p>}
      <div className="vp-form-actions">
        <button className="button" type="submit">{initial ? '更新观点' : '添加观点'}</button>
      </div>
    </form>
  );
}

// ─── Viewpoint Card ────────────────────────────────────────────────
function ViewpointCard({ viewpoint, blogger, onEdit, onDelete }) {
  return (
    <div className="vp-viewpoint-card glass">
      <div className="vp-viewpoint-header">
        <div className="vp-viewpoint-meta">
          <span className="vp-blogger-badge">{blogger?.name || '未知博主'}</span>
          <span className="muted" style={{ fontSize: '12px' }}>{viewpoint.date}</span>
        </div>
        <div className="vp-viewpoint-actions">
          <span className="vp-sentiment-tag" style={{
            background: sentimentColor(viewpoint.sentiment) + '22',
            color: sentimentColor(viewpoint.sentiment),
            borderColor: sentimentColor(viewpoint.sentiment) + '44',
          }}>
            {sentimentLabel(viewpoint.sentiment)}
          </span>
          <button className="vp-icon-btn" onClick={() => onEdit(viewpoint)} title="编辑">✎</button>
          <button className="vp-icon-btn vp-danger" onClick={() => onDelete(viewpoint.id)} title="删除">✕</button>
        </div>
      </div>
      {viewpoint.title && <h4 className="vp-viewpoint-title">{viewpoint.title}</h4>}
      <p className="vp-viewpoint-summary">{viewpoint.summary}</p>
      {viewpoint.tags?.length > 0 && (
        <div className="vp-tags">
          {viewpoint.tags.map((t, i) => <span key={i} className="vp-tag">{t}</span>)}
        </div>
      )}
      {viewpoint.videoUrl && (
        <div className="vp-viewpoint-footer">
          <a href={viewpoint.videoUrl} target="_blank" rel="noopener noreferrer" className="vp-video-link">
            ▶ 观看原视频
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function ViewpointsBoard() {
  const [data, setData] = useState({ bloggers: [], viewpoints: [] });
  const [view, setView] = useState('feed'); // feed | add-blogger | add-viewpoint
  const [editingBlogger, setEditingBlogger] = useState(null);
  const [editingViewpoint, setEditingViewpoint] = useState(null);
  const [activeBloggerId, setActiveBloggerId] = useState(null);
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [searchTag, setSearchTag] = useState('');

  useEffect(() => {
    setData(loadData());
  }, []);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const addBlogger = (blogger) => {
    const id = editingBlogger?.id || genId();
    setData(prev => {
      const bloggers = editingBlogger
        ? prev.bloggers.map(b => b.id === id ? { ...b, ...blogger, id } : b)
        : [...prev.bloggers, { ...blogger, id }];
      return { ...prev, bloggers };
    });
    setEditingBlogger(null);
    setView('feed');
  };

  const deleteBlogger = (id) => {
    if (!confirm('确定要删除这位博主及其所有观点吗？')) return;
    setData(prev => ({
      bloggers: prev.bloggers.filter(b => b.id !== id),
      viewpoints: prev.viewpoints.filter(v => v.bloggerId !== id),
    }));
    if (activeBloggerId === id) setActiveBloggerId(null);
  };

  const addViewpoint = (vp) => {
    const id = editingViewpoint?.id || genId();
    setData(prev => {
      const viewpoints = editingViewpoint
        ? prev.viewpoints.map(v => v.id === id ? { ...v, ...vp, id } : v)
        : [...prev.viewpoints, { ...vp, id, createdAt: new Date().toISOString() }];
      return { ...prev, viewpoints };
    });
    setEditingViewpoint(null);
    setView('feed');
  };

  const deleteViewpoint = (id) => {
    if (!confirm('确定要删除这条观点吗？')) return;
    setData(prev => ({
      ...prev,
      viewpoints: prev.viewpoints.filter(v => v.id !== id),
    }));
  };

  const getBlogger = (id) => data.bloggers.find(b => b.id === id);

  // Filtered viewpoints
  const filteredViewpoints = data.viewpoints
    .filter(vp => {
      if (activeBloggerId && vp.bloggerId !== activeBloggerId) return false;
      if (filterSentiment !== 'all' && vp.sentiment !== filterSentiment) return false;
      if (searchTag) {
        const q = searchTag.toLowerCase();
        const tags = (vp.tags || []).join(' ').toLowerCase();
        const summary = vp.summary?.toLowerCase() || '';
        const title = vp.title?.toLowerCase() || '';
        const blogger = getBlogger(vp.bloggerId)?.name?.toLowerCase() || '';
        return tags.includes(q) || summary.includes(q) || title.includes(q) || blogger.includes(q);
      }
      return true;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const bloggerViewpointCount = (bloggerId) =>
    data.viewpoints.filter(v => v.bloggerId === bloggerId).length;

  return (
    <div className="vp-container glass">
      {/* Header */}
      <div className="vp-header">
        <div>
          <h2 className="vp-title">观点看板</h2>
          <p className="muted" style={{ fontSize: '13px' }}>
            记录和整理你关注的博主观点 · 共{data.bloggers.length}位博主 · {data.viewpoints.length}条观点
          </p>
        </div>
        <div className="vp-header-actions">
          <button className="button secondary analysis-button small" onClick={() => { setEditingBlogger(null); setView('add-blogger'); }}>
            + 添加博主
          </button>
          <button className="button analysis-button small" onClick={() => { setEditingViewpoint(null); setView('add-viewpoint'); }}>
            + 记录观点
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'feed' ? (
        <div className="vp-body">
          {/* Sidebar: Bloggers */}
          <aside className="vp-sidebar">
            <div className="vp-sidebar-header">
              <span className="muted" style={{ fontSize: '13px', fontWeight: 600 }}>博主列表</span>
            </div>
            <div className="vp-blogger-list">
              <div className={`vp-blogger-card ${!activeBloggerId ? 'vp-active' : ''}`} onClick={() => setActiveBloggerId(null)}>
                <div className="vp-blogger-info">
                  <strong>全部博主</strong>
                  <span className="muted" style={{ fontSize: '11px' }}>{data.viewpoints.length}条观点</span>
                </div>
              </div>
              {data.bloggers.map(b => (
                <BloggerCard
                  key={b.id} blogger={b}
                  viewpointCount={bloggerViewpointCount(b.id)}
                  active={activeBloggerId === b.id}
                  onSelect={(b) => setActiveBloggerId(activeBloggerId === b.id ? null : b.id)}
                  onEdit={(b) => { setEditingBlogger(b); setView('add-blogger'); }}
                  onDelete={(id) => deleteBlogger(id)}
                />
              ))}
            </div>
          </aside>

          {/* Main: Viewpoints Feed */}
          <main className="vp-main">
            <div className="vp-feed-toolbar">
              <div className="vp-filters">
                <button className={`vp-filter-btn ${filterSentiment === 'all' ? 'active' : ''}`} onClick={() => setFilterSentiment('all')}>全部</button>
                {SENTIMENT_OPTIONS.map(o => (
                  <button key={o.value}
                    className={`vp-filter-btn ${filterSentiment === o.value ? 'active' : ''}`}
                    style={filterSentiment === o.value ? { borderColor: o.color, color: o.color } : {}}
                    onClick={() => setFilterSentiment(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <input className="input vp-search" placeholder="搜索观点、标签、博主..." value={searchTag} onChange={e => setSearchTag(e.target.value)} />
            </div>

            <div className="vp-feed">
              {filteredViewpoints.length === 0 && (
                <div className="vp-empty">
                  <p>暂无观点记录</p>
                  <p className="muted" style={{ fontSize: '13px', marginTop: 8 }}>
                    先添加博主，然后开始记录他们的观点吧
                  </p>
                </div>
              )}
              {filteredViewpoints.map(vp => (
                <ViewpointCard
                  key={vp.id} viewpoint={vp}
                  blogger={getBlogger(vp.bloggerId)}
                  onEdit={(vp) => { setEditingViewpoint(vp); setView('add-viewpoint'); }}
                  onDelete={(id) => deleteViewpoint(id)}
                />
              ))}
            </div>
          </main>
        </div>
      ) : view === 'add-blogger' ? (
        <div className="vp-form-container glass card">
          <div className="vp-form-header">
            <h3>{editingBlogger ? '编辑博主' : '添加博主'}</h3>
            <button className="vp-icon-btn" onClick={() => { setEditingBlogger(null); setView('feed'); }} title="关闭">✕</button>
          </div>
          <BloggerForm onSave={addBlogger} initial={editingBlogger} />
        </div>
      ) : view === 'add-viewpoint' ? (
        <div className="vp-form-container glass card">
          <div className="vp-form-header">
            <h3>{editingViewpoint ? '编辑观点' : '记录新观点'}</h3>
            <button className="vp-icon-btn" onClick={() => { setEditingViewpoint(null); setView('feed'); }} title="关闭">✕</button>
          </div>
          <ViewpointForm bloggers={data.bloggers} onSave={addViewpoint} initial={editingViewpoint} />
        </div>
      ) : null}
    </div>
  );
}
