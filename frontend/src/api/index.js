import api from './client';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (data) => api.post('/auth/refresh', data),
  logout: (data) => api.post('/auth/logout', data),
  getMe: () => api.get('/auth/me'),
};

export const entryApi = {
  getEntries: (params) => api.get('/entries', { params }),
  getToday: (params) => api.get('/entries/today', { params }),
  getByDate: (date) => api.get('/entries/today', { params: { date } }),
  getEntry: (id) => api.get(`/entries/${id}`),
  createEntry: (data) => api.post('/entries', data),
  updateEntry: (id, data) => api.put(`/entries/${id}`, data),
  deleteEntry: (id) => api.delete(`/entries/${id}`),
};

export const goalApi = {
  getActive: () => api.get('/goals'),
  create: (data) => api.post('/goals', data),
  getHistory: (params) => api.get('/goals/history', { params }),
  update: (id, data) => api.put(`/goals/${id}`, data),
  delete: (id) => api.delete(`/goals/${id}`),
};

export const reportApi = {
  weeklyCalories: (params) => api.get('/reports/weekly-calories', { params }),
  macros: (params) => api.get('/reports/macros', { params }),
  micros: (params) => api.get('/reports/micros', { params }),
  goalComparison: (params) => api.get('/reports/goal-comparison', { params }),
  mealDistribution: (params) => api.get('/reports/meal-distribution', { params }),
};

export const aiApi = {
  analyzeImage: (formData) =>
    api.post('/ai/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),
  chat: (data) => api.post('/ai/chat', data, { timeout: 60000 }),
  getChatHistory: () => api.get('/ai/chat/history'),
  clearChatHistory: () => api.delete('/ai/chat/history'),
  importPdf: (formData) =>
    api.post('/ai/import-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
};
