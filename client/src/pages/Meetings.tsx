import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, FileText, Trash2, ChevronRight, Brain, AlertCircle, FileDown } from 'lucide-react';
import api from '../services/api';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  participants: string[];
  analysis: any;
}

interface TranscriptInput {
  timestamp: string;
  speaker: string;
  text: string;
}

const SPRINT_TEMPLATE = [
  { timestamp: '00:10', speaker: 'John', text: 'Thanks for joining. We need to plan our next sprint and figure out when to launch.' },
  { timestamp: '00:25', speaker: 'Alice', text: 'I think we can target next Friday for the deployment. I will prepare release notes by next Wednesday.' },
  { timestamp: '00:45', speaker: 'John', text: 'That sounds perfect. Make sure the database migration scripts are ready before that. Bob should audit them.' },
  { timestamp: '01:10', speaker: 'Alice', text: 'I will sync with Bob on Monday. We also need to send the final client review request today.' },
  { timestamp: '01:30', speaker: 'John', text: 'I will email the client review. Let us meet again on Tuesday to finalize everything.' }
];

const BOARD_TEMPLATE = [
  { timestamp: '00:05', speaker: 'Sarah', text: 'Let us discuss the redesign sign-off. We need to launch the new dashboard interface.' },
  { timestamp: '00:20', speaker: 'Dave', text: 'I finished the high-fidelity mockups. Sarah, could you review and approve them by Monday afternoon?' },
  { timestamp: '00:40', speaker: 'Sarah', text: 'Yes, I will review them on Monday. I will also notify the engineering team to begin estimation.' },
  { timestamp: '01:05', speaker: 'Dave', text: 'Awesome. I will compile the asset files and upload them to shared storage before Monday morning.' }
];

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  
  // Meeting list states
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  
  // Filters
  const [emailFilter, setEmailFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<TranscriptInput[]>([
    { timestamp: '00:00', speaker: '', text: '' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch meetings
  const fetchMeetings = async () => {
    setLoadingList(true);
    try {
      const params: any = {
        page: page.toString(),
        limit: limit.toString(),
      };
      if (emailFilter) params.participantEmail = emailFilter;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const response = await api.get('/meetings', { params });
      const { meetings: fetchedMeetings, total: fetchedTotal } = response.data.data;
      setMeetings(fetchedMeetings);
      setTotal(fetchedTotal);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [page, emailFilter, startDate, endDate]);

  const handleAddParticipant = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && participantInput.trim()) {
      e.preventDefault();
      const email = participantInput.trim().toLowerCase();
      // Simple email check
      if (email.includes('@') && !participants.includes(email)) {
        setParticipants([...participants, email]);
        setParticipantInput('');
      }
    }
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleTranscriptChange = (index: number, field: keyof TranscriptInput, value: string) => {
    const updated = [...transcript];
    updated[index][field] = value;
    setTranscript(updated);
  };

  const handleAddTranscriptLine = () => {
    setTranscript([...transcript, { timestamp: '', speaker: '', text: '' }]);
  };

  const handleRemoveTranscriptLine = (index: number) => {
    setTranscript(transcript.filter((_, i) => i !== index));
  };

  const handleLoadTemplate = (type: 'sprint' | 'board') => {
    if (type === 'sprint') {
      setTitle('Sprint Planning & Review');
      setMeetingDate(new Date().toISOString().substring(0, 16));
      setParticipants(['john@example.com', 'alice@example.com', 'bob@example.com']);
      setTranscript(SPRINT_TEMPLATE);
    } else {
      setTitle('Dashboard Redesign Alignment');
      setMeetingDate(new Date().toISOString().substring(0, 16));
      setParticipants(['sarah@example.com', 'dave@example.com']);
      setTranscript(BOARD_TEMPLATE);
    }
  };

  const handleCreateMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (participants.length === 0) {
      setFormError('Please add at least one participant.');
      return;
    }

    const invalidSegment = transcript.find(t => !t.timestamp || !t.speaker || !t.text);
    if (invalidSegment) {
      setFormError('Please complete all transcript lines.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        meetingDate: new Date(meetingDate).toISOString(),
        participants,
        transcript
      };
      
      const response = await api.post('/meetings', payload);
      const newMeeting = response.data.data;
      
      // Close form and navigate to newly created meeting
      setIsCreating(false);
      setTitle('');
      setMeetingDate('');
      setParticipants([]);
      setTranscript([{ timestamp: '00:00', speaker: '', text: '' }]);
      navigate(`/meetings/${newMeeting.id}`);
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setFormError(err.response.data.error.message || 'Failed to create meeting.');
      } else {
        setFormError('Failed to connect to backend.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="fade-in" style={styles.container}>
      <div style={styles.listHeader}>
        <div>
          <h1 style={styles.pageTitle}>Meetings Hub</h1>
          <p style={styles.pageDesc}>Store transcripts and generate intelligent, grounded insights.</p>
        </div>
        {!isCreating && (
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={18} />
            <span>Create Meeting</span>
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="glass-card slide-up" style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>New Meeting Transcript</h2>
            <div style={styles.templateControls}>
              <span style={styles.templateLabel}>Load Template:</span>
              <button className="btn btn-secondary" style={styles.templateBtn} onClick={() => handleLoadTemplate('sprint')}>
                <FileDown size={14} />
                <span>Sprint Planning</span>
              </button>
              <button className="btn btn-secondary" style={styles.templateBtn} onClick={() => handleLoadTemplate('board')}>
                <FileDown size={14} />
                <span>Board Redesign</span>
              </button>
            </div>
          </div>

          {formError && (
            <div style={styles.errorBanner}>
              <AlertCircle size={18} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateMeetingSubmit}>
            <div style={styles.formGrid}>
              <div className="input-group">
                <label className="input-label">Meeting Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Weekly Standup, Project Kickoff"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Participants (Type email and press Enter or Comma)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. developer@company.com"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleAddParticipant}
              />
              <div style={styles.chipsContainer}>
                {participants.map((email, idx) => (
                  <div key={idx} style={styles.chip}>
                    <span>{email}</span>
                    <button type="button" style={styles.chipRemove} onClick={() => handleRemoveParticipant(idx)}>
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript Lines */}
            <div style={styles.transcriptSection}>
              <h3 style={styles.subTitle}>Transcript Segments</h3>
              <div style={styles.transcriptHeaders}>
                <span style={{ ...styles.columnHeader, width: '15%' }}>Timestamp</span>
                <span style={{ ...styles.columnHeader, width: '25%' }}>Speaker</span>
                <span style={{ ...styles.columnHeader, width: '50%' }}>Spoken Text</span>
                <span style={{ ...styles.columnHeader, width: '10%' }}>Action</span>
              </div>

              {transcript.map((line, idx) => (
                <div key={idx} style={styles.transcriptLine}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '15%', padding: '0.5rem' }}
                    placeholder="e.g. 00:10"
                    value={line.timestamp}
                    onChange={(e) => handleTranscriptChange(idx, 'timestamp', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '25%', padding: '0.5rem' }}
                    placeholder="Speaker Name"
                    value={line.speaker}
                    onChange={(e) => handleTranscriptChange(idx, 'speaker', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '50%', padding: '0.5rem' }}
                    placeholder="Type speech transcript text here..."
                    value={line.text}
                    onChange={(e) => handleTranscriptChange(idx, 'text', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    style={styles.deleteLineBtn}
                    onClick={() => handleRemoveTranscriptLine(idx)}
                    disabled={transcript.length <= 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button type="button" className="btn btn-secondary" style={styles.addLineBtn} onClick={handleAddTranscriptLine}>
                <Plus size={16} />
                <span>Add Segment Line</span>
              </button>
            </div>

            <div style={styles.formActions}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Save & View Meeting'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={styles.mainGrid}>
          {/* Filters Column */}
          <div className="glass-card" style={styles.filterCard}>
            <h3 style={styles.filterTitle}>Filter Meetings</h3>
            
            <div className="input-group">
              <label className="input-label">Participant Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="Search by participant..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">From Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">To Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {(emailFilter || startDate || endDate) && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setEmailFilter('');
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* List Column */}
          <div style={styles.listColumn}>
            {loadingList ? (
              <div style={styles.listLoading}>
                <div className="shimmer" style={styles.shimmerRow}></div>
                <div className="shimmer" style={styles.shimmerRow}></div>
                <div className="shimmer" style={styles.shimmerRow}></div>
              </div>
            ) : meetings.length === 0 ? (
              <div className="glass-card" style={styles.emptyList}>
                <FileText size={48} color="hsl(var(--text-muted))" style={{ marginBottom: '1rem' }} />
                <p>No meetings found matching the filters.</p>
              </div>
            ) : (
              <div style={styles.meetingsStack}>
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="glass-card meeting-card-item"
                    style={styles.meetingCard}
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                  >
                    <div style={styles.meetingInfoMain}>
                      <h3 style={styles.meetingTitleText}>{meeting.title}</h3>
                      <div style={styles.meetingMetaInfo}>
                        <div style={styles.metaRow}>
                          <Calendar size={14} color="hsl(var(--text-muted))" />
                          <span>{new Date(meeting.meetingDate).toLocaleString()}</span>
                        </div>
                        <div style={styles.metaRow}>
                          <Users size={14} color="hsl(var(--text-muted))" />
                          <span>{meeting.participants.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.meetingCardRight}>
                      {meeting.analysis ? (
                        <span className="badge badge-completed">
                          <Brain size={12} />
                          <span>Grounded Analysis Ready</span>
                        </span>
                      ) : (
                        <span className="badge badge-pending">
                          <span>Awaiting AI Analysis</span>
                        </span>
                      )}
                      <ChevronRight size={20} color="hsl(var(--text-muted))" />
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={styles.pagination}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Prev
                    </button>
                    <span style={styles.pageIndicator}>Page {page} of {totalPages}</span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: '2rem',
    marginBottom: '0.25rem',
  },
  pageDesc: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.95rem',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 3fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  filterCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  filterTitle: {
    fontSize: '1.1rem',
    marginBottom: '0.25rem',
  },
  listColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  listLoading: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  shimmerRow: {
    height: '110px',
    borderRadius: 'var(--radius-md)',
  },
  emptyList: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
    color: 'hsl(var(--text-muted))',
    textAlign: 'center' as const,
  },
  meetingsStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  meetingCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    cursor: 'pointer',
    background: 'hsla(var(--bg-card) / 0.5)',
  },
  meetingInfoMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  meetingTitleText: {
    fontSize: '1.15rem',
    fontWeight: 600,
  },
  meetingMetaInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: 'hsl(var(--text-muted))',
  },
  meetingCardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    marginTop: '1rem',
  },
  pageIndicator: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
  },
  formCard: {
    background: 'hsla(var(--bg-card) / 0.7)',
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid hsl(var(--border-color))',
    paddingBottom: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    gap: '1rem',
  },
  formTitle: {
    fontSize: '1.4rem',
  },
  templateControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  templateLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'hsl(var(--text-muted))',
    textTransform: 'uppercase' as const,
  },
  templateBtn: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '0.8rem 1.2rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  chipsContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  chip: {
    background: 'hsl(var(--border-color))',
    border: '1px solid hsl(var(--text-dark) / 0.4)',
    color: 'hsl(var(--text-main))',
    padding: '0.25rem 0.6rem',
    borderRadius: '100px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.8rem',
  },
  chipRemove: {
    background: 'transparent',
    border: 'none',
    color: 'hsl(var(--text-muted))',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  transcriptSection: {
    marginTop: '2rem',
    borderTop: '1px solid hsl(var(--border-color))',
    paddingTop: '1.5rem',
    marginBottom: '1.5rem',
  },
  subTitle: {
    fontSize: '1.15rem',
    marginBottom: '1rem',
  },
  transcriptHeaders: {
    display: 'flex',
    padding: '0 0.5rem 0.5rem 0.5rem',
    borderBottom: '1px solid hsl(var(--border-color))',
    marginBottom: '0.75rem',
  },
  columnHeader: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'hsl(var(--text-muted))',
    textTransform: 'uppercase' as const,
  },
  transcriptLine: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  deleteLineBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-smooth)',
  },
  addLineBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    borderTop: '1px solid hsl(var(--border-color))',
    paddingTop: '1.5rem',
    marginTop: '1.5rem',
  },
};

// Add standard hover rules
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent += `
    .meeting-card-item:hover {
      border-color: hsl(var(--primary) / 0.4) !important;
      transform: translateY(-2px);
      box-shadow: 0 8px 30px -8px hsl(var(--primary-glow));
    }
    .meeting-card-item {
      transition: var(--transition-smooth) !important;
    }
  `;
  document.head.appendChild(style);
}
