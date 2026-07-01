export const DEFAULT_ANALYSIS_API_URL = 'https://fund-baby-analysis.onrender.com';

export function normalizeApiBase(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  const base = raw || DEFAULT_ANALYSIS_API_URL;
  return base.replace(/\/+$/, '');
}

export function buildAnalysisApiUrl(path, base = process.env.NEXT_PUBLIC_ANALYSIS_API_URL) {
  const cleanPath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return `${normalizeApiBase(base)}${cleanPath}`;
}
