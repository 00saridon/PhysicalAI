const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
async function _fetch(path, init) {
    const res = await fetch(`${BASE}${path}`, init);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return res.json();
}
export const api = {
    health: () => _fetch('/health'),
    getStatus: () => _fetch('/status'),
    runStage: (stage, options) => {
        const params = new URLSearchParams();
        if (options?.validate)
            params.set('validate', 'true');
        const qs = params.toString() ? `?${params}` : '';
        return _fetch(`/run/${stage}${qs}`, { method: 'POST' });
    },
    getArtifacts: () => _fetch('/artifacts'),
    artifactDownloadUrl: (id) => `${BASE}/artifacts/${id}/download`,
    getDemos: () => _fetch('/demos'),
    getConfig: () => _fetch('/config'),
};
