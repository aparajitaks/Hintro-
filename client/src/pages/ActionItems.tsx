import React, { useEffect, useState } from 'react';
import { 
  ListTodo, CheckCircle2, Clock, 
  RefreshCw, Check, ShieldAlert, Play
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  citations: { timestamp: string }[];
  meeting: {
    id: string;
    title: string;
  };
}

export const ActionItems: React.FC = () => {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const toast = useToast();

  const fetchActionItems = async () => {
    try {
      const response = await api.get('/action-items');
      // Express response: res.data.data
      setItems(response.data.data || []);
    } catch (err) {
      console.error('Failed to load action items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActionItems();
  }, []);

  const handleSimulateReminders = async () => {
    setTriggeringReminders(true);
    try {
      await api.post('/action-items/trigger-reminders');
      toast.success('Scan completed successfully! Check the server logs to view queued or sent emails.');
    } catch (err: any) {
      console.error(err);
      toast.error('Reminder trigger failed. Check server console for error logs.');
    } finally {
      setTriggeringReminders(false);
    }
  };

  const handleStatusCycle = async (itemId: string, currentStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    let nextStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    if (currentStatus === 'PENDING') {
      nextStatus = 'IN_PROGRESS';
    } else if (currentStatus === 'IN_PROGRESS') {
      nextStatus = 'COMPLETED';
    } else {
      return;
    }

    setUpdatingItemId(itemId);
    try {
      await api.patch(`/action-items/${itemId}/status`, { status: nextStatus });
      await fetchActionItems();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || 'Illegal status transition.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const now = new Date();
  
  // Categorize items
  const overdueItems = items.filter(
    (item) => item.status !== 'COMPLETED' && new Date(item.dueDate) < now
  );
  
  const activeItems = items.filter(
    (item) => item.status !== 'COMPLETED' && new Date(item.dueDate) >= now
  );
  
  const completedItems = items.filter(
    (item) => item.status === 'COMPLETED'
  );

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="shimmer" style={{ ...styles.shimmerBox, height: '150px' }}></div>
        <div className="shimmer" style={{ ...styles.shimmerBox, height: '350px' }}></div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Action Items & Schedulers</h1>
          <p style={styles.pageDesc}>Track assigned tasks and execute transaction notifications.</p>
        </div>

        <button 
          className="btn btn-success" 
          disabled={triggeringReminders} 
          onClick={handleSimulateReminders}
          style={styles.triggerBtn}
        >
          {triggeringReminders ? (
            <RefreshCw className="spin-animation" size={16} />
          ) : (
            <Play size={16} />
          )}
          <span>{triggeringReminders ? 'Scanning...' : 'Simulate Overdue Reminders'}</span>
        </button>
      </div>


      {/* Grid containing categories */}
      <div style={styles.itemsGrid}>
        
        {/* Overdue column */}
        <div style={styles.column}>
          <div style={styles.columnTitleRow}>
            <ShieldAlert size={18} color="hsl(350, 89%, 60%)" />
            <h3 style={styles.columnHeaderTitle}>Overdue Reminders ({overdueItems.length})</h3>
          </div>

          {overdueItems.length === 0 ? (
            <div className="glass-card" style={styles.emptyCard}>
              <CheckCircle2 size={24} color="hsl(160, 84%, 39%)" />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>No overdue items! Great job.</p>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {overdueItems.map((item) => (
                <div key={item.id} className="glass-card" style={{ ...styles.itemCard, border: '1px solid hsl(350, 89%, 60% / 0.3)' }}>
                  <div style={styles.cardInfo}>
                    <span style={styles.taskText}>{item.task}</span>
                    <span style={styles.meetingRef}>Meeting: {item.meeting?.title}</span>
                    <div style={styles.assigneeRow}>
                      <span style={styles.label}>Assignee:</span>
                      <span style={styles.value}>{item.assignee}</span>
                    </div>
                    <div style={styles.dueDateRow}>
                      <span style={styles.label}>Due Date:</span>
                      <span style={{ ...styles.value, color: 'hsl(350, 89%, 60%)', fontWeight: 'bold' }}>
                        {new Date(item.dueDate).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={styles.cardActionRow}>
                    <span className="badge badge-pending">OVERDUE</span>
                    <button 
                      className="btn btn-secondary" 
                      style={styles.actionBtn}
                      disabled={updatingItemId === item.id}
                      onClick={() => handleStatusCycle(item.id, item.status)}
                    >
                      {updatingItemId === item.id ? (
                        <RefreshCw className="spin-animation" size={12} />
                      ) : item.status === 'PENDING' ? (
                        <span>Start Work</span>
                      ) : (
                        <span>Complete</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active/Pending column */}
        <div style={styles.column}>
          <div style={styles.columnTitleRow}>
            <Clock size={18} color="hsl(250, 89%, 65%)" />
            <h3 style={styles.columnHeaderTitle}>Active Tasks ({activeItems.length})</h3>
          </div>

          {activeItems.length === 0 ? (
            <div className="glass-card" style={styles.emptyCard}>
              <ListTodo size={24} color="hsl(var(--text-muted))" />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>No pending active tasks.</p>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {activeItems.map((item) => (
                <div key={item.id} className="glass-card" style={styles.itemCard}>
                  <div style={styles.cardInfo}>
                    <span style={styles.taskText}>{item.task}</span>
                    <span style={styles.meetingRef}>Meeting: {item.meeting?.title}</span>
                    <div style={styles.assigneeRow}>
                      <span style={styles.label}>Assignee:</span>
                      <span style={styles.value}>{item.assignee}</span>
                    </div>
                    <div style={styles.dueDateRow}>
                      <span style={styles.label}>Due Date:</span>
                      <span style={styles.value}>{new Date(item.dueDate).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={styles.cardActionRow}>
                    {item.status === 'PENDING' ? (
                      <span className="badge badge-pending">PENDING</span>
                    ) : (
                      <span className="badge badge-progress">IN PROGRESS</span>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      style={styles.actionBtn}
                      disabled={updatingItemId === item.id}
                      onClick={() => handleStatusCycle(item.id, item.status)}
                    >
                      {updatingItemId === item.id ? (
                        <RefreshCw className="spin-animation" size={12} />
                      ) : item.status === 'PENDING' ? (
                        <span>Start Work</span>
                      ) : (
                        <span>Complete</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed column */}
        <div style={styles.column}>
          <div style={styles.columnTitleRow}>
            <CheckCircle2 size={18} color="hsl(160, 84%, 39%)" />
            <h3 style={styles.columnHeaderTitle}>Completed Tasks ({completedItems.length})</h3>
          </div>

          {completedItems.length === 0 ? (
            <div className="glass-card" style={styles.emptyCard}>
              <Clock size={24} color="hsl(var(--text-muted))" />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>No completed tasks recorded yet.</p>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {completedItems.map((item) => (
                <div key={item.id} className="glass-card" style={{ ...styles.itemCard, opacity: 0.8 }}>
                  <div style={styles.cardInfo}>
                    <span style={{ ...styles.taskText, textDecoration: 'line-through', color: 'hsl(var(--text-muted))' }}>
                      {item.task}
                    </span>
                    <span style={styles.meetingRef}>Meeting: {item.meeting?.title}</span>
                    <div style={styles.assigneeRow}>
                      <span style={styles.label}>Assignee:</span>
                      <span style={styles.value}>{item.assignee}</span>
                    </div>
                    <div style={styles.dueDateRow}>
                      <span style={styles.label}>Completed Date:</span>
                      <span style={styles.value}>
                        {new Date(item.dueDate).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={styles.cardActionRow}>
                    <span className="badge badge-completed">
                      <Check size={12} />
                      <span>COMPLETED</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  shimmerBox: {
    borderRadius: 'var(--radius-lg)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '1rem',
  },
  pageTitle: {
    fontSize: '2rem',
    marginBottom: '0.25rem',
  },
  pageDesc: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.95rem',
  },
  triggerBtn: {
    boxShadow: '0 0 15px hsl(160, 84%, 39% / 0.2)',
  },
  notificationAlert: {
    background: 'hsl(160, 84%, 39% / 0.08)',
    border: '1px solid hsl(160, 84%, 39% / 0.2)',
    color: 'hsl(160, 84%, 39%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem',
    padding: '0.9rem 1.25rem',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
    alignItems: 'start',
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  columnTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid hsl(var(--border-color))',
    paddingBottom: '0.5rem',
  },
  columnHeaderTitle: {
    fontSize: '1rem',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    textAlign: 'center' as const,
    color: 'hsl(var(--text-muted))',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  itemCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    background: 'hsla(var(--bg-card) / 0.5)',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  taskText: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.4,
  },
  meetingRef: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
    fontStyle: 'italic' as const,
    marginBottom: '0.25rem',
  },
  assigneeRow: {
    display: 'flex',
    gap: '0.25rem',
    fontSize: '0.8rem',
  },
  dueDateRow: {
    display: 'flex',
    gap: '0.25rem',
    fontSize: '0.8rem',
  },
  label: {
    color: 'hsl(var(--text-muted))',
  },
  value: {
    color: 'hsl(var(--text-main))',
  },
  cardActionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid hsl(var(--border-color))',
    paddingTop: '0.5rem',
  },
  actionBtn: {
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
  },
};
