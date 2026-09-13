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

/**
 * Polls background BullMQ file processing status until 'completed' or 'failed'.
 */
const pollUploadStatus = async (fileUploadId, maxAttempts = 40, intervalMs = 1500) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const res = await api.get(`/ai/status/${fileUploadId}`);
    const data = res.data;

    if (data.status === 'completed') {
      return {
        data: {
          success: true,
          status: 'completed',
          data: data.data,
          imported: Array.isArray(data.data) ? data.data.length : undefined,
          cloudinaryUrl: data.cloudinaryUrl,
        },
      };
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Background processing failed');
    }
  }
  throw new Error('Background AI processing timed out. Please try again.');
};

export const aiApi = {
  analyzeImage: async (formData) => {
    const res = await api.post('/ai/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });

    // If result was already available (cache or deduplication)
    if (res.data?.status === 'completed' && res.data?.data) {
      return res;
    }

    // If enqueued in BullMQ, poll status until completed
    if (res.data?.fileUploadId && (res.data?.status === 'pending' || res.data?.status === 'processing')) {
      return await pollUploadStatus(res.data.fileUploadId);
    }

    return res;
  },

  importPdf: async (formData) => {
    const res = await api.post('/ai/import-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });

    // If result was already available
    if (res.data?.status === 'completed' && res.data?.data) {
      return res;
    }

    // If enqueued in BullMQ, poll status until completed
    if (res.data?.fileUploadId && (res.data?.status === 'pending' || res.data?.status === 'processing')) {
      return await pollUploadStatus(res.data.fileUploadId);
    }

    return res;
  },

  getStatus: (id) => api.get(`/ai/status/${id}`),
  chat: (data) => api.post('/ai/chat', data, { timeout: 60000 }),
  getChatHistory: () => api.get('/ai/chat/history'),
  clearChatHistory: () => api.delete('/ai/chat/history'),
};
