(function attachAppApi(global) {
  function withQuery(url, params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      searchParams.set(key, String(value));
    });
    const query = searchParams.toString();
    return query ? `${url}?${query}` : url;
  }

  async function request(url, options = {}) {
    const nextOptions = {
      cache: 'no-store',
      ...options,
    };
    return fetch(url, nextOptions);
  }

  async function fetchJson(url, options = {}) {
    const res = await request(url, options);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.response = res;
      throw err;
    }
    return res.json();
  }

  async function readError(res) {
    const data = await res.json().catch(() => ({}));
    return data.error || '';
  }

  global.AppApi = Object.freeze({
    fetchJson,
    readError,
    request,
    withQuery,
  });
})(window);
