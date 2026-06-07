import axios from 'axios';

// Create configured Axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to generate unique trace IDs (UUIDv4 style or simple unique string)
function generateTraceId(): string {
  return 'trace-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
}

// Request Interceptor to add Auth token and Trace ID
api.interceptors.request.use(
  (config) => {
    // Inject Trace ID for backend request traceability
    config.headers['X-Trace-Id'] = generateTraceId();

    // Inject JWT token if stored in local storage
    const token = localStorage.getItem('hintro_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor to handle unauthenticated state globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear credentials on token expiration
      localStorage.removeItem('hintro_token');
      localStorage.removeItem('hintro_user');
      
      // Optionally redirect to login page if window is available
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
