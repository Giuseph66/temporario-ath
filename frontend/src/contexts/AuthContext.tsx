import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface AuthContextType {
    accessToken: string | null;
    tenantId: string | null;
    login: (accessToken: string, refreshToken: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    accessToken: null, tenantId: null, login: () => {}, logout: () => {},
});

// ── Token helpers ────────────────────────────────────────────────────────────

function getStored(key: string) { return localStorage.getItem(key); }
function setStored(key: string, val: string) { localStorage.setItem(key, val); }
function clearStored() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
}

// ── Axios request interceptor — injects latest token from localStorage ───────
// Registered at module level so it survives re-renders.
export const reqInterceptorId = axios.interceptors.request.use(config => {
    const token = getStored('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Silent refresh state — prevents concurrent refresh storms ─────────────────
let refreshPromise: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const rt = getStored('refreshToken');
        if (!rt) return null;
        try {
            const { data } = await axios.post('/auth/refresh', { refreshToken: rt });
            const newAt: string = data.accessToken;
            setStored('accessToken', newAt);
            if (data.refreshToken) setStored('refreshToken', data.refreshToken);
            return newAt;
        } catch {
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [accessToken, setAccessToken] = useState<string | null>(
        getStored('accessToken')
    );

    function login(at: string, rt: string) {
        setStored('accessToken', at);
        setStored('refreshToken', rt);
        setAccessToken(at);
    }

    function logout() {
        clearStored();
        setAccessToken(null);
        window.location.href = '/login';
    }

    useEffect(() => {
        // Response interceptor: on 401, try silent refresh before giving up
        const resId = axios.interceptors.response.use(
            r => r,
            async err => {
                const original = err.config;

                // Only attempt refresh once per request and not on auth endpoints
                if (
                    err.response?.status === 401 &&
                    !original._retried &&
                    !original.url?.includes('/auth/')
                ) {
                    original._retried = true;
                    const newToken = await silentRefresh();

                    if (newToken) {
                        // Update React state so PrivateRoute stays open
                        setAccessToken(newToken);
                        original.headers.Authorization = `Bearer ${newToken}`;
                        return axios(original);
                    }

                    // Refresh failed — session truly expired
                    logout();
                }

                return Promise.reject(err);
            }
        );

        return () => axios.interceptors.response.eject(resId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tenantId = accessToken
        ? (JSON.parse(atob(accessToken.split('.')[1])) as { tenantId: string }).tenantId
        : null;

    return (
        <AuthContext.Provider value={{ accessToken, tenantId, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
