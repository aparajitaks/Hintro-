import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, ListTodo, LogOut, LayoutDashboard, Database } from 'lucide-react';
import api from '../services/api';

interface EvaluationInfo {
  candidateName: string;
  email: string;
  repositoryUrl: string;
  deployedUrl: string;
}

export const Navbar: React.FC = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [evalInfo, setEvalInfo] = useState<EvaluationInfo | null>(null);

  useEffect(() => {
    // Fetch evaluation metadata to show candidate credentials on Navbar
    api.get('/evaluation')
      .then(res => {
        // Express returns standardized envelope
        if (res.data && res.data.success) {
          setEvalInfo(res.data.data);
        } else {
          setEvalInfo(res.data);
        }
      })
      .catch(() => {
        // Ignore fallback
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div style={styles.logoContainer}>
        <div style={styles.logoIcon}>
          <Database size={20} color="white" />
        </div>
        <span style={styles.logoText}>Hintro</span>
        <span style={styles.logoBadge}>Intelligence</span>
      </div>

      {isAuthenticated && (
        <div style={styles.navLinks}>
          <Link
            to="/"
            style={{
              ...styles.link,
              ...(isActive('/') ? styles.linkActive : {}),
            }}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/meetings"
            style={{
              ...styles.link,
              ...(isActive('/meetings') ? styles.linkActive : {}),
            }}
          >
            <Calendar size={16} />
            <span>Meetings Hub</span>
          </Link>
          <Link
            to="/action-items"
            style={{
              ...styles.link,
              ...(isActive('/action-items') ? styles.linkActive : {}),
            }}
          >
            <ListTodo size={16} />
            <span>Action Items</span>
          </Link>
        </div>
      )}

      <div style={styles.rightSection}>
        {evalInfo && (
          <div style={styles.evalCard}>
            <div style={styles.evalDot}></div>
            <div style={styles.evalText}>
              <span style={styles.evalLabel}>Candidate:</span>
              <span style={styles.evalValue}>{evalInfo.candidateName}</span>
            </div>
          </div>
        )}

        {isAuthenticated && user && (
          <div style={styles.userSection}>
            <span style={styles.emailText}>{user.email}</span>
            <button onClick={handleLogout} style={styles.logoutBtn} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    background: 'hsla(222, 47%, 12%, 0.8)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid hsl(217, 32%, 17%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 2rem',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoIcon: {
    background: 'linear-gradient(135deg, hsl(250, 89%, 65%), hsl(265, 89%, 60%))',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 15px hsl(250, 89%, 65% / 0.3)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '1.25rem',
    letterSpacing: '-0.02em',
  },
  logoBadge: {
    fontSize: '0.7rem',
    background: 'hsl(250, 89%, 65% / 0.1)',
    border: '1px solid hsl(250, 89%, 65% / 0.2)',
    color: 'hsl(250, 89%, 65%)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  link: {
    color: 'hsl(var(--text-muted))',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'var(--transition-smooth)',
  },
  linkActive: {
    background: 'hsl(var(--border-color))',
    color: 'hsl(var(--text-main))',
    border: '1px solid hsl(var(--border-color))',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  evalCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'hsl(160, 84%, 39% / 0.08)',
    border: '1px solid hsl(160, 84%, 39% / 0.2)',
    padding: '0.35rem 0.75rem',
    borderRadius: '100px',
  },
  evalDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'hsl(160, 84%, 39%)',
    boxShadow: '0 0 8px hsl(160, 84%, 39%)',
  },
  evalText: {
    fontSize: '0.75rem',
    display: 'flex',
    gap: '0.25rem',
  },
  evalLabel: {
    color: 'hsl(var(--text-muted))',
  },
  evalValue: {
    fontWeight: 600,
    color: 'hsl(var(--text-main))',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderLeft: '1px solid hsl(217, 32%, 17%)',
    paddingLeft: '1.25rem',
  },
  emailText: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--text-muted))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.4rem',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition-smooth)',
  },
};
