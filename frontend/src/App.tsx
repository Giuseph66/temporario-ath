import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './layouts/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Leads } from './pages/Leads';
import { Conversas } from './pages/Conversas';
import { Agente } from './pages/Agente';
import { Integracoes } from './pages/Integracoes';
import { Contatos } from './pages/Contatos';
import { Produtos } from './pages/Produtos';
import { Logs } from './pages/Logs';
import { Asaas } from './pages/Asaas';
import { Simulador } from './pages/Simulador';
import { Memorias } from './pages/Memorias';
import { Automacoes } from './pages/Automacoes';
import { ConsumoAI } from './pages/ConsumoAI';
import { Billing } from './pages/Billing';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { accessToken } = useAuth();
    return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const token = localStorage.getItem('adminAccessToken');
    return token ? <>{children}</> : <Navigate to="/zeruela/login" replace />;
}

function App() {
    return (
        <ThemeProvider>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login"      element={<Login />} />
                    <Route path="/register"   element={<Register />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard"   element={<Dashboard />} />
                        <Route path="conversas"   element={<Conversas />} />
                        <Route path="leads"       element={<Leads />} />
                        <Route path="integracoes" element={<Integracoes />} />
                        <Route path="contatos"    element={<Contatos />} />
                        <Route path="agente"      element={<Agente />} />
                        <Route path="memorias"    element={<Memorias />} />
                        <Route path="automacoes"  element={<Automacoes />} />
                        <Route path="consumo-ai"  element={<ConsumoAI />} />
                        <Route path="produtos"    element={<Produtos />} />
                        <Route path="config"      element={<Settings />} />
                        <Route path="logs"        element={<Logs />} />
                        <Route path="asaas"       element={<Asaas />} />
                        <Route path="simulador"   element={<Simulador />} />
                        <Route path="assinatura"  element={<Billing />} />
                    </Route>
                    {/* Admin routes — completely isolated from tenant app */}
                    <Route path="/zeruela/login"     element={<AdminLogin />} />
                    <Route path="/zeruela/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/zeruela" element={<Navigate to="/zeruela/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
