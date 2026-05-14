import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface AuthContextType {
    accessToken: string | null;
    tenantId: string | null;
    login: (accessToken: string, refreshToken: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ accessToken: null, tenantId: null, login: () => {}, logout: () => {} });

// Interceptor registrado no nível do módulo — antes de qualquer render/query
const reqInterceptorId = axios.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [accessToken, setAccessToken] = useState<string | null>(
        localStorage.getItem('accessToken')
    );

    useEffect(() => {
        // Interceptor de resposta — redireciona para login em 401
        const resId = axios.interceptors.response.use(
            r => r,
            err => {
                if (err.response?.status === 401) logout();
                return Promise.reject(err);
            }
        );
        return () => {
            axios.interceptors.response.eject(resId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function login(at: string, rt: string) {
        localStorage.setItem('accessToken', at);
        localStorage.setItem('refreshToken', rt);
        setAccessToken(at);
    }

    function logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setAccessToken(null);
        window.location.href = '/login';
    }

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
export { reqInterceptorId };
