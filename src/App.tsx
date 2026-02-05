import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import EmployeeCheckIn from './pages/EmployeeCheckIn';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeApp from './pages/EmployeeApp';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Branches from './pages/Branches';
import Shifts from './pages/Shifts';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import LeaveRequests from './pages/LeaveRequests';
import LeaveTypes from './pages/LeaveTypes';
import TimezoneAlerts from './pages/TimezoneAlerts';
import FraudAlerts from './pages/FraudAlerts';
import Settings from './pages/Settings';
import DeviceApprovals from './pages/DeviceApprovals';
import PresentToday from './pages/PresentToday';
import PresentNow from './pages/PresentNow';
import DelayPermissions from './pages/DelayPermissions';
import DelayPermissionTest from './pages/DelayPermissionTest';
import FreeTasks from './pages/FreeTasks';

function AppContent() {
  const { user, loading, isAdmin } = useAuth();

  const isRegisterPage = window.location.pathname === '/register';
  const isResetPasswordPage = window.location.pathname === '/reset-password';
  const isAuthCallbackPage = window.location.pathname === '/auth/callback';
  const isEmployeeLoginPage = window.location.pathname === '/employee-login';
  const isEmployeeApp = window.location.pathname === '/employee-app';
  const isDelayTestPage = window.location.pathname === '/dev/delay-permission-test';

  // Debug logging for route guard
  console.log('APP_ROUTE_GUARD:', {
    loading,
    hasUser: !!user,
    isAdmin,
    pathname: window.location.pathname
  });

  if (isAuthCallbackPage) {
    return <AuthCallback />;
  }

  if (isEmployeeLoginPage) {
    return <EmployeeLogin />;
  }

  if (isEmployeeApp) {
    return <EmployeeApp />;
  }

  if (isDelayTestPage) {
    return <DelayPermissionTest />;
  }

  if (isResetPasswordPage) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isRegisterPage) {
    return <Register />;
  }

  if (!user || !isAdmin) {
    console.log('APP_ROUTE_GUARD: denying access, showing Login');
    return <Login />;
  }

  console.log('APP_ROUTE_GUARD: access granted, showing Dashboard');

  return (
    <Layout>
      <Dashboard />
      <Employees />
      <Departments />
      <Branches />
      <Shifts />
      <Attendance />
      <PresentToday />
      <PresentNow />
      <Reports />
      <Payroll />
      <LeaveRequests />
      <LeaveTypes />
      <DelayPermissions />
      <FreeTasks />
      <TimezoneAlerts />
      <FraudAlerts />
      <DeviceApprovals />
      <Settings />
    </Layout>
  );
}

import { Toaster } from 'sonner';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
