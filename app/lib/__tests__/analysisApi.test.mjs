import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalysisApiUrl, normalizeApiBase } from '../analysisApi.mjs';

test('normalizeApiBase falls back to cloud analysis backend', () => {
  assert.equal(normalizeApiBase(''), 'https://fund-baby-analysis.onrender.com');
});

test('normalizeApiBase removes trailing slashes', () => {
  assert.equal(normalizeApiBase('http://127.0.0.1:8000///'), 'http://127.0.0.1:8000');
});

test('buildAnalysisApiUrl joins base and path', () => {
  assert.equal(buildAnalysisApiUrl('/api/health', 'http://localhost:8000/'), 'http://localhost:8000/api/health');
  assert.equal(buildAnalysisApiUrl('api/analyze', 'http://localhost:8000'), 'http://localhost:8000/api/analyze');
});
