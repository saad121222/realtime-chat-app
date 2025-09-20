import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

let tokenCache = null;

api.setToken = (token) => {
  tokenCache = token;
};

api.interceptors.request.use((config) => {
  if (tokenCache) {
    config.headers.Authorization = `Bearer ${tokenCache}`;
  }
  return config;
});

export default api;
