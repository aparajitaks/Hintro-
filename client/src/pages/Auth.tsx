import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Key, Mail, Loader2, Sparkles } from 'lucide-react';

export const Auth: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error.message || 'Authentication failed');
      } else {
        setError('Connection failed. Is the server running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.decorCircle1}></div>
      <div style={styles.decorCircle2}></div>

      <div className="glass-card slide-up" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Sparkles size={24} color="white" />
          </div>
          <h1 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
          <p style={styles.subtitle}>
            {isLogin 
              ? 'Sign in to access your meeting intelligence reports.' 
              : 'Register to start analyzing meeting transcripts.'}
          </p>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div style={styles.inputContainer}>
              <Mail style={styles.inputIcon} size={18} />
              <input
                type="email"
                className="form-input"
                style={styles.inputWithIcon}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={styles.inputContainer}>
              <Key style={styles.inputIcon} size={18} />
              <input
                type="password"
                className="form-input"
                style={styles.inputWithIcon}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
            {loading ? (
              <Loader2 className="spin-animation" size={18} />
            ) : isLogin ? (
              <LogIn size={18} />
            ) : (
              <UserPlus size={18} />
            )}
            <span>{loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}</span>
          </button>
        </form>

        <div style={styles.toggleFooter}>
          <button onClick={() => setIsLogin(!isLogin)} style={styles.toggleBtn}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add spinner keyframes dynamically to document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spin-animation {
      animation: spin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 70px)',
    position: 'relative' as const,
    overflow: 'hidden',
    padding: '1.5rem',
  },
  decorCircle1: {
    position: 'absolute' as const,
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, hsl(250, 89%, 65% / 0.15) 0%, transparent 70%)',
    top: '10%',
    left: '10%',
    zIndex: 0,
  },
  decorCircle2: {
    position: 'absolute' as const,
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, hsl(160, 84%, 39% / 0.12) 0%, transparent 70%)',
    bottom: '5%',
    right: '5%',
    zIndex: 0,
  },
  card: {
    maxWidth: '450px',
    width: '100%',
    zIndex: 1,
    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  logoBadge: {
    background: 'linear-gradient(135deg, hsl(250, 89%, 65%), hsl(265, 89%, 60%))',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px hsl(250, 89%, 65% / 0.4)',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.75rem',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: 1.5,
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '0.8rem 1rem',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  inputContainer: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '12px',
    color: 'hsl(var(--text-muted))',
  },
  inputWithIcon: {
    paddingLeft: '2.5rem',
    width: '100%',
  },
  submitBtn: {
    justifyContent: 'center',
    marginTop: '0.75rem',
    width: '100%',
  },
  toggleFooter: {
    marginTop: '1.5rem',
    textAlign: 'center' as const,
    borderTop: '1px solid hsl(var(--border-color))',
    paddingTop: '1.25rem',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--primary))',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
};
