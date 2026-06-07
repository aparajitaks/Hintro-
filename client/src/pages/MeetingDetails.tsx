import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Users, Brain, Play, CheckCircle2, 
  MessageSquare, ClipboardList, RefreshCw, Sparkles, Clock, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

interface AnalysisItem {
  text: string;
  citations: { timestamp: string }[];
}

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  citations: { timestamp: string }[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
}

interface MeetingDetailsData {
  id: string;
  title: string;
  meetingDate: string;
  participants: string[];
  transcript: TranscriptSegment[];
  analysis: {
    summary: AnalysisItem[];
    decisions: AnalysisItem[];
    followUps: AnalysisItem[];
  } | null;
  actionItems: ActionItem[];
}

export const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [meeting, setMeeting] = useState<MeetingDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'decisions' | 'followUps' | 'actionItems'>('summary');
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [actionItemUpdating, setActionItemUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcriptScrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchMeetingDetails = async () => {
    try {
      const response = await api.get(`/meetings/${id}`);
      // Express response: res.data.data
      setMeeting(response.data.data);
    } catch (err) {
      console.error('Failed to load meeting details', err);
      setError('Meeting not found or network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingDetails();
  }, [id]);

  const handleTriggerAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await api.post(`/meetings/${id}/analyze`);
      await fetchMeetingDetails();
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error.message || 'AI analysis failed.');
      } else {
        setError('Connection failed during analysis.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCitationClick = (timestamp: string) => {
    setActiveHighlight(timestamp);
    // Find the transcript line with that timestamp
    const element = document.getElementById(`segment-${timestamp}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleTransitionStatus = async (itemId: string, currentStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    let nextStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    if (currentStatus === 'PENDING') {
      nextStatus = 'IN_PROGRESS';
    } else if (currentStatus === 'IN_PROGRESS') {
      nextStatus = 'COMPLETED';
    } else {
      return; // COMPLETED is the terminal state
    }

    setActionItemUpdating(itemId);
    try {
      await api.patch(`/action-items/${itemId}/status`, { status: nextStatus });
      await fetchMeetingDetails();
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error.message || 'Illegal state transition.');
      } else {
        toast.error('Failed to update action item status.');
      }
    } finally {
      setActionItemUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="shimmer" style={{ ...styles.shimmerBox, height: '400px' }}></div>
        <div className="shimmer" style={{ ...styles.shimmerBox, height: '400px' }}></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="glass-card" style={styles.notFoundCard}>
        <AlertCircle size={48} color="hsl(350, 89%, 60%)" />
        <h2 style={{ marginTop: '1rem' }}>Meeting Not Found</h2>
        <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/meetings')}>
          Back to Meetings
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={styles.container}>
      {/* Detail Page Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/meetings')} style={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>Meetings Hub</span>
        </button>
        <div style={styles.titleArea}>
          <h1 style={styles.meetingTitle}>{meeting.title}</h1>
          <div style={styles.metaRow}>
            <div style={styles.metaItem}>
              <Calendar size={14} />
              <span>{new Date(meeting.meetingDate).toLocaleString()}</span>
            </div>
            <div style={styles.metaItem}>
              <Users size={14} />
              <span>{meeting.participants.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Workspace Grid */}
      <div style={styles.workspaceGrid}>
        
        {/* Left Column: Transcript */}
        <div className="glass-card" style={styles.transcriptColumn}>
          <div style={styles.columnTitleBar}>
            <MessageSquare size={18} color="white" />
            <h2 style={styles.columnTitle}>Meeting Transcript</h2>
          </div>

          <div 
            ref={transcriptScrollContainerRef} 
            style={styles.transcriptContainer}
          >
            {meeting.transcript.length === 0 ? (
              <p style={styles.noTranscript}>No transcript segments found.</p>
            ) : (
              meeting.transcript.map((segment) => {
                const isHighlighted = activeHighlight === segment.timestamp;
                return (
                  <div
                    key={segment.id}
                    id={`segment-${segment.timestamp}`}
                    className={`transcript-bubble ${isHighlighted ? 'highlighted-segment' : ''}`}
                    style={{
                      ...styles.segmentCard,
                      ...(isHighlighted ? styles.highlightedBorder : {}),
                    }}
                    onClick={() => setActiveHighlight(segment.timestamp)}
                  >
                    <div style={styles.segmentMeta}>
                      <span style={styles.segmentSpeaker}>{segment.speaker}</span>
                      <span 
                        style={{
                          ...styles.segmentTime,
                          ...(isHighlighted ? styles.highlightedTime : {}),
                        }}
                      >
                        {segment.timestamp}
                      </span>
                    </div>
                    <p style={styles.segmentText}>{segment.text}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: AI Analysis */}
        <div className="glass-card" style={styles.analysisColumn}>
          
          {!meeting.analysis ? (
            <div style={styles.aiLockedState}>
              {analyzing ? (
                <div style={styles.analyzingLoader}>
                  <Brain size={48} className="spin-animation" style={{ color: 'hsl(var(--primary))' }} />
                  <h3 style={styles.analyzingText}>Extracting Grounded Insights...</h3>
                  <p style={styles.analyzingSub}>Groq AI is auditing the transcript and validating timestamps.</p>
                  <div style={styles.loadingBar}>
                    <div style={styles.loadingProgress}></div>
                  </div>
                </div>
              ) : (
                <div style={styles.promptAnalysis}>
                  <Brain size={54} color="hsl(var(--primary))" style={{ marginBottom: '1rem' }} />
                  <h2 style={styles.promptTitle}>AI Grounded Insights</h2>
                  <p style={styles.promptDesc}>
                    Run the Groq intelligence engine to generate meeting summaries, key decisions, and action items linked directly to transcript segments.
                  </p>
                  <button className="btn btn-primary" style={styles.analyzeBtn} onClick={handleTriggerAnalysis}>
                    <Play size={16} />
                    <span>Run AI Analysis</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.analysisDetails}>
              {/* Tab Navigation */}
              <div style={styles.tabBar}>
                <button
                  style={{ ...styles.tabBtn, ...(activeTab === 'summary' ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab('summary')}
                >
                  <Sparkles size={14} />
                  <span>Summary</span>
                </button>
                <button
                  style={{ ...styles.tabBtn, ...(activeTab === 'decisions' ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab('decisions')}
                >
                  <CheckCircle2 size={14} />
                  <span>Decisions</span>
                </button>
                <button
                  style={{ ...styles.tabBtn, ...(activeTab === 'followUps' ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab('followUps')}
                >
                  <Clock size={14} />
                  <span>Follow-ups</span>
                </button>
                <button
                  style={{ ...styles.tabBtn, ...(activeTab === 'actionItems' ? styles.tabActive : {}) }}
                  onClick={() => setActiveTab('actionItems')}
                >
                  <ClipboardList size={14} />
                  <span>Action Items</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div style={styles.tabContentContainer}>
                {activeTab === 'summary' && (
                  <div className="fade-in" style={styles.tabSection}>
                    <h3 style={styles.sectionHeading}>Meeting Summary</h3>
                    {(!meeting.analysis?.summary || meeting.analysis.summary.length === 0) ? (
                      <p style={styles.noData}>No summary items generated.</p>
                    ) : (
                      meeting.analysis.summary.map((item, idx) => (
                        <div key={idx} style={styles.insightListItem}>
                          <p style={styles.insightText}>{item.text}</p>
                          <div style={styles.citationsRow}>
                            {(item.citations || []).map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="citation-badge"
                                onClick={() => handleCitationClick(c.timestamp)}
                              >
                                @ {c.timestamp}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'decisions' && (
                  <div className="fade-in" style={styles.tabSection}>
                    <h3 style={styles.sectionHeading}>Core Decisions Made</h3>
                    {(!meeting.analysis?.decisions || meeting.analysis.decisions.length === 0) ? (
                      <p style={styles.noData}>No key decisions identified.</p>
                    ) : (
                      meeting.analysis.decisions.map((item, idx) => (
                        <div key={idx} style={styles.insightListItem}>
                          <p style={styles.insightText}>{item.text}</p>
                          <div style={styles.citationsRow}>
                            {(item.citations || []).map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="citation-badge"
                                onClick={() => handleCitationClick(c.timestamp)}
                              >
                                @ {c.timestamp}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'followUps' && (
                  <div className="fade-in" style={styles.tabSection}>
                    <h3 style={styles.sectionHeading}>Next Follow-ups</h3>
                    {(!meeting.analysis?.followUps || meeting.analysis.followUps.length === 0) ? (
                      <p style={styles.noData}>No future follow-ups recorded.</p>
                    ) : (
                      meeting.analysis.followUps.map((item, idx) => (
                        <div key={idx} style={styles.insightListItem}>
                          <p style={styles.insightText}>{item.text}</p>
                          <div style={styles.citationsRow}>
                            {(item.citations || []).map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="citation-badge"
                                onClick={() => handleCitationClick(c.timestamp)}
                              >
                                @ {c.timestamp}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'actionItems' && (
                  <div className="fade-in" style={styles.tabSection}>
                    <h3 style={styles.sectionHeading}>Assigned Tasks & Action Items</h3>
                    {(!meeting.actionItems || meeting.actionItems.length === 0) ? (
                      <p style={styles.noData}>No action items registered for this meeting.</p>
                    ) : (
                      <div style={styles.actionItemsList}>
                        {meeting.actionItems.map((item) => (
                          <div key={item.id} style={item.id ? styles.actionItemCard : {}}>
                            <div style={styles.actionCardHeader}>
                              <span style={styles.actionTask}>{item.task}</span>
                              <div style={styles.citationsRow}>
                                {(item.citations || []).map((c, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="citation-badge"
                                    onClick={() => handleCitationClick(c.timestamp)}
                                  >
                                    @ {c.timestamp}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div style={styles.actionCardDetails}>
                              <div style={styles.detailBlock}>
                                <span style={styles.detailLabel}>Assignee:</span>
                                <span style={styles.detailValue}>{item.assignee}</span>
                              </div>
                              <div style={styles.detailBlock}>
                                <span style={styles.detailLabel}>Due Date:</span>
                                <span style={styles.detailValue}>{new Date(item.dueDate).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div style={styles.actionCardFooter}>
                              <div>
                                {item.status === 'PENDING' && (
                                  <span className="badge badge-pending">Pending</span>
                                )}
                                {item.status === 'IN_PROGRESS' && (
                                  <span className="badge badge-progress">In Progress</span>
                                )}
                                {item.status === 'COMPLETED' && (
                                  <span className="badge badge-completed">Completed</span>
                                )}
                              </div>
                              
                              {item.status !== 'COMPLETED' && (
                                <button
                                  className="btn btn-secondary"
                                  style={styles.transitionBtn}
                                  disabled={actionItemUpdating === item.id}
                                  onClick={() => handleTransitionStatus(item.id, item.status)}
                                >
                                  {actionItemUpdating === item.id ? (
                                    <RefreshCw className="spin-animation" size={12} />
                                  ) : item.status === 'PENDING' ? (
                                    <span>Start Progress</span>
                                  ) : (
                                    <span>Complete</span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  shimmerBox: {
    borderRadius: 'var(--radius-lg)',
  },
  notFoundCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--text-muted))',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  meetingTitle: {
    fontSize: '1.8rem',
  },
  metaRow: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '0.8rem 1.2rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem',
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    alignItems: 'stretch',
  },
  transcriptColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '600px',
    background: 'hsla(var(--bg-card) / 0.5)',
  },
  columnTitleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderBottom: '1px solid hsl(var(--border-color))',
    paddingBottom: '0.75rem',
    marginBottom: '1rem',
  },
  columnTitle: {
    fontSize: '1.1rem',
  },
  transcriptContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    paddingRight: '0.5rem',
  },
  noTranscript: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.9rem',
    textAlign: 'center' as const,
    marginTop: '3rem',
  },
  segmentCard: {
    background: 'hsl(var(--bg-darker) / 0.4)',
    border: '1px solid hsl(var(--border-color))',
    padding: '0.9rem 1.2rem',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  segmentMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.4rem',
  },
  segmentSpeaker: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'hsl(var(--text-main))',
  },
  segmentTime: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
    fontFamily: 'monospace',
    background: 'hsl(var(--border-color))',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    transition: 'var(--transition-smooth)',
  },
  segmentText: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-main) / 0.9)',
    lineHeight: 1.5,
  },
  highlightedBorder: {
    borderColor: 'hsl(var(--warning))',
    boxShadow: '0 0 15px hsl(var(--warning-glow))',
    background: 'hsl(var(--warning-glow) / 0.05)',
  },
  highlightedTime: {
    background: 'hsl(var(--warning))',
    color: 'black',
    fontWeight: 'bold',
  },
  analysisColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '600px',
    background: 'hsla(var(--bg-card) / 0.5)',
  },
  aiLockedState: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
  },
  promptAnalysis: {
    maxWidth: '350px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  promptTitle: {
    fontSize: '1.4rem',
    marginBottom: '0.5rem',
  },
  promptDesc: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  analyzeBtn: {
    padding: '0.8rem 1.8rem',
  },
  analyzingLoader: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
  },
  analyzingText: {
    fontSize: '1.2rem',
  },
  analyzingSub: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
  },
  loadingBar: {
    width: '240px',
    height: '4px',
    background: 'hsl(var(--border-color))',
    borderRadius: '100px',
    overflow: 'hidden',
    marginTop: '0.5rem',
  },
  loadingProgress: {
    height: '100%',
    width: '50%',
    background: 'hsl(var(--primary))',
    borderRadius: '100px',
    animation: 'shimmer-progress 1.5s infinite linear',
  },
  analysisDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid hsl(var(--border-color))',
    paddingBottom: '0.5rem',
    gap: '0.25rem',
    overflowX: 'auto' as const,
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--text-muted))',
    padding: '0.6rem 0.9rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'var(--transition-smooth)',
  },
  tabActive: {
    background: 'hsl(var(--border-color))',
    color: 'hsl(var(--primary))',
    fontWeight: 600,
  },
  tabContentContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingTop: '1rem',
  },
  tabSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  sectionHeading: {
    fontSize: '1rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'hsl(var(--text-muted))',
  },
  noData: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.9rem',
  },
  insightListItem: {
    background: 'hsl(var(--bg-darker) / 0.4)',
    border: '1px solid hsl(var(--border-color))',
    padding: '1rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  insightText: {
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  citationsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.4rem',
  },
  actionItemsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  actionItemCard: {
    background: 'hsl(var(--bg-darker) / 0.4)',
    border: '1px solid hsl(var(--border-color))',
    padding: '1rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  actionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: '1rem',
  },
  actionTask: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.4,
  },
  actionCardDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    background: 'hsl(var(--bg-darker) / 0.2)',
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius-sm)',
  },
  detailBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.15rem',
  },
  detailLabel: {
    fontSize: '0.75rem',
    color: 'hsl(var(--text-muted))',
  },
  detailValue: {
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  actionCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.25rem',
  },
  transitionBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
  },
};

// Add standard animation styling
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent += `
    @keyframes progress-shimmer {
      from { transform: translateX(-150%); }
      to { transform: translateX(250%); }
    }
    .transcript-bubble:hover {
      background: hsl(var(--bg-darker) / 0.8) !important;
      border-color: hsl(var(--text-dark) / 0.5) !important;
    }
  `;
  document.head.appendChild(style);
}
