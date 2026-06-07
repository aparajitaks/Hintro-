import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Meetings } from './pages/Meetings';
import { MeetingDetails } from './pages/MeetingDetails';
import { ActionItems } from './pages/ActionItems';

// Protected Route wrapper component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// Layout component with consistent structure
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/auth" element={<Auth />} />

          {/* Protected Routes wrapped in Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/meetings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Meetings />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/meetings/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <MeetingDetails />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/action-items"
            element={
              <ProtectedRoute>
                <Layout>
                  <ActionItems />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

const styles = {
  loadingScreen: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0b0f19',
    color: '#fff',
    gap: '1rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid hsl(var(--border-color))',
    borderTopColor: 'hsl(var(--primary))',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
  },
};
