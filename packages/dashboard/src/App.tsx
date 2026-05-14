import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { accessToken } = useAuth();
    return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login"      element={<Login />} />
                    <Route path="/register"   element={<Register />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard"   element={<Dashboard />} />
                        <Route path="conversas"   element={<div style={{ padding: 40 }}>Conversas — em breve</div>} />
                        <Route path="leads"       element={<div style={{ padding: 40 }}>Leads — em breve</div>} />
                        <Route path="integracoes" element={<div style={{ padding: 40 }}>Integrações — em breve</div>} />
                        <Route path="agente"      element={<div style={{ padding: 40 }}>Agente — em breve</div>} />
                        <Route path="config"      element={<Settings />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
