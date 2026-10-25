import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.startsWith('/auth/')) onUnauthorized();
    return Promise.reject(err);
  },
);

export function errorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  if (err.response?.data?.error?.message) return err.response.data.error.message;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the API running?';
  return err.message || fallback;
}

/** Copy server-side field errors into react-hook-form. Returns true if any matched. */
export function applyServerErrors(err, setError) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return false;
  let applied = false;
  for (const d of details) {
    if (d.path) {
      setError(d.path, { type: 'server', message: d.message });
      applied = true;
    }
  }
  return applied;
}
