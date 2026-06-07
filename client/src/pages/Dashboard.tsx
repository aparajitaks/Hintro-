import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ListTodo, AlertCircle, Clock, ArrowRight, Brain, Activity } from 'lucide-react';
import api from '../services/api';

interface Stats {
  totalMeetings: number;
  totalActionItems: number;
  overdueActionItems: number;
  pendingActionItems: number;
  inProgressActionItems: number;
  completedActionItems: number;
}

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  participants: string[];
  analysis: any;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalMeetings: 0,
    totalActionItems: 0,
    overdueActionItems: 0,
    pendingActionItems: 0,
    inProgressActionItems: 0,
    completedActionItems: 0,
  });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meetingsRes = await api.get('/meetings');
        const itemsRes = await api.get('/action-items');
        const overdueRes = await api.get('/action-items/overdue');

        // Extract data based on envelope structure: res.data.data
        const meetingList = meetingsRes.data.data.meetings || [];
        const actionItemsList = itemsRes.data.data || [];
        const overdueList = overdueRes.data.data || [];

        setMeetings(meetingList.slice(0, 5)); // Show top 5 recent meetings

        const pending = actionItemsList.filter((item: any) => item.status === 'PENDING').length;
        const inProgress = actionItemsList.filter((item: any) => item.status === 'IN_PROGRESS').length;
        const completed = actionItemsList.filter((item: any) => item.status === 'COMPLETED').length;

        setStats({
          totalMeetings: meetingsRes.data.data.total || meetingList.length,
          totalActionItems: actionItemsList.length,
          overdueActionItems: overdueList.length,
          pendingActionItems: pending,
          inProgressActionItems: inProgress,
          completedActionItems: completed,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="shimmer" style={styles.shimmerCard}></div>
        <div className="shimmer" style={styles.shimmerCard}></div>
        <div className="shimmer" style={styles.shimmerCard}></div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={styles.header}>
        <div>
          <h1 style={styles.welcomeTitle}>Dashboard</h1>
          <p style={styles.welcomeSubtitle}>Here is an overview of your meeting intelligence metrics.</p>
        </div>
        <div style={styles.pulseBadge}>
          <Activity size={14} className="spin-animation" style={{ animationDuration: '3s' }} />
          <span>System Active</span>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div style={styles.statsGrid}>
        <div className="glass-card" style={styles.statCard} onClick={() => navigate('/meetings')}>
          <div style={{ ...styles.iconBg, background: 'hsl(250, 89%, 65% / 0.15)', color: 'hsl(250, 89%, 65%)' }}>
            <Calendar size={24} />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Total Meetings</span>
            <span style={styles.statValue}>{stats.totalMeetings}</span>
          </div>
        </div>

        <div className="glass-card" style={styles.statCard} onClick={() => navigate('/action-items')}>
          <div style={{ ...styles.iconBg, background: 'hsl(35, 92%, 50% / 0.15)', color: 'hsl(35, 92%, 50%)' }}>
            <ListTodo size={24} />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Total Action Items</span>
            <span style={styles.statValue}>{stats.totalActionItems}</span>
          </div>
        </div>

        <div className="glass-card" style={{ ...styles.statCard, border: stats.overdueActionItems > 0 ? '1px solid hsl(350, 89% 60% / 0.3)' : '1px solid hsl(var(--border-color))' }} onClick={() => navigate('/action-items')}>
          <div style={{ ...styles.iconBg, background: stats.overdueActionItems > 0 ? 'hsl(350, 89%, 60% / 0.15)' : 'hsl(var(--text-muted) / 0.15)', color: stats.overdueActionItems > 0 ? 'hsl(350, 89%, 60%)' : 'hsl(var(--text-muted))' }}>
            <AlertCircle size={24} />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Overdue Items</span>
            <span style={{ ...styles.statValue, color: stats.overdueActionItems > 0 ? 'hsl(350, 89%, 60%)' : 'inherit' }}>
              {stats.overdueActionItems}
            </span>
          </div>
        </div>
      </div>

      {/* Action Item Status Distribution */}
      <div className="glass-card" style={styles.distributionCard}>
        <h3 style={styles.sectionTitle}>Action Item Status</h3>
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressSegment, width: `${(stats.completedActionItems / (stats.totalActionItems || 1)) * 100}%`, background: 'hsl(160, 84%, 39%)' }} title="Completed"></div>
            <div style={{ ...styles.progressSegment, width: `${(stats.inProgressActionItems / (stats.totalActionItems || 1)) * 100}%`, background: 'hsl(250, 89%, 65%)' }} title="In Progress"></div>
            <div style={{ ...styles.progressSegment, width: `${(stats.pendingActionItems / (stats.totalActionItems || 1)) * 100}%`, background: 'hsl(35, 92%, 50%)' }} title="Pending"></div>
          </div>
        </div>
        <div style={styles.legendGrid}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: 'hsl(160, 84%, 39%)' }}></span>
            <span style={styles.legendLabel}>Completed ({stats.completedActionItems})</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: 'hsl(250, 89%, 65%)' }}></span>
            <span style={styles.legendLabel}>In Progress ({stats.inProgressActionItems})</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: 'hsl(35, 92%, 50%)' }}></span>
            <span style={styles.legendLabel}>Pending ({stats.pendingActionItems})</span>
          </div>
        </div>
      </div>

      {/* Row containing recent meetings and shortcuts */}
      <div style={styles.dashboardRow}>
        {/* Recent meetings */}
        <div className="glass-card" style={styles.meetingsPanel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Recent Meetings</h3>
            <button onClick={() => navigate('/meetings')} style={styles.viewAllBtn}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {meetings.length === 0 ? (
            <div style={styles.emptyState}>
              <Clock size={32} color="hsl(var(--text-muted))" style={{ marginBottom: '0.5rem' }} />
              <p>No meetings recorded yet.</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/meetings')}>
                Create Meeting
              </button>
            </div>
          ) : (
            <div style={styles.meetingList}>
              {meetings.map((meeting) => (
                <div key={meeting.id} style={styles.meetingItem} onClick={() => navigate(`/meetings/${meeting.id}`)}>
                  <div style={styles.meetingItemLeft}>
                    <span style={styles.meetingTitle}>{meeting.title}</span>
                    <span style={styles.meetingDate}>
                      {new Date(meeting.meetingDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={styles.meetingItemRight}>
                    {meeting.analysis ? (
                      <span className="badge badge-completed">
                        <Brain size={12} />
                        <span>Analyzed</span>
                      </span>
                    ) : (
                      <span className="badge badge-pending">
                        <span>Not Analyzed</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="glass-card" style={styles.quickActionsPanel}>
          <h3 style={styles.panelTitle}>Quick Tools</h3>
          <div style={styles.actionsGrid}>
            <div style={styles.actionButtonCard} onClick={() => navigate('/meetings')}>
              <span style={styles.actionCardTitle}>New Transcript Analysis</span>
              <span style={styles.actionCardDesc}>Paste a speech transcript and extract tasks using Groq AI.</span>
            </div>
            <div style={styles.actionButtonCard} onClick={() => navigate('/action-items')}>
              <span style={styles.actionCardTitle}>Email Reminders Simulator</span>
              <span style={styles.actionCardDesc}>Trigger emails manually via Resend API to verify the cron worker.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  loadingContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  shimmerCard: {
    height: '120px',
    borderRadius: 'var(--radius-lg)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  welcomeTitle: {
    fontSize: '2rem',
    marginBottom: '0.25rem',
  },
  welcomeSubtitle: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.95rem',
  },
  pulseBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'hsl(160, 84%, 39% / 0.08)',
    border: '1px solid hsl(160, 84%, 39% / 0.2)',
    padding: '0.4rem 0.8rem',
    borderRadius: '100px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'hsl(160, 84%, 39%)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    cursor: 'pointer',
  },
  iconBg: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statLabel: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
    fontWeight: 500,
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    marginTop: '0.25rem',
  },
  distributionCard: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
  },
  progressContainer: {
    height: '16px',
    background: 'hsl(var(--border-color))',
    borderRadius: '100px',
    overflow: 'hidden',
    marginBottom: '1rem',
  },
  progressBar: {
    display: 'flex',
    height: '100%',
    width: '100%',
  },
  progressSegment: {
    height: '100%',
    transition: 'width 0.5s ease',
  },
  legendGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '1.5rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  legendLabel: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
  },
  dashboardRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1.5rem',
  },
  meetingsPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  panelTitle: {
    fontSize: '1.1rem',
  },
  viewAllBtn: {
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--primary))',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 0',
    color: 'hsl(var(--text-muted))',
    fontSize: '0.9rem',
  },
  meetingList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  meetingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.9rem 1.2rem',
    background: 'hsl(var(--bg-darker) / 0.4)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  meetingItemHover: {
    borderColor: 'hsl(var(--primary) / 0.4)',
  },
  meetingItemLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  meetingTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  meetingDate: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
  },
  meetingItemRight: {},
  quickActionsPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  },
  actionsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    height: '100%',
  },
  actionButtonCard: {
    background: 'hsl(var(--bg-darker) / 0.4)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: 'var(--radius-md)',
    padding: '1.2rem',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  actionCardTitle: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'hsl(var(--primary))',
  },
  actionCardDesc: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: 1.4,
  },
};

// Apply simple hover state styling
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent += `
    .meeting-item:hover {
      border-color: hsl(var(--primary) / 0.4) !important;
      background: hsl(var(--bg-darker) / 0.8) !important;
    }
    .action-button-card:hover {
      border-color: hsl(var(--primary) / 0.4) !important;
      background: hsl(var(--bg-darker) / 0.8) !important;
    }
  `;
  document.head.appendChild(style);
}
