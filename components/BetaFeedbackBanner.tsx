'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  MessageSquare,
  Lightbulb,
  Send,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Loader2
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/* =========================
   CONFIGURATION
========================= */
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfKz7APwz8S1jNcqApZIr-XgV7AjxbYNfi36eUD8RTgUmcctg/formResponse';
const GOOGLE_SHEET_CSV_URL = 'YOUR_PUBLISHED_SHEET_CSV_URL'; // Publish your linked Google Sheet: File → Share → Publish to web → CSV

// Google Form field entry IDs
const FORM_FIELDS = {
  contact: 'entry.1428967819',    // User Name or Email
  feedback: 'entry.590651661',    // Feedback field
  feature: 'entry.1118737533',    // Feature Request field
};

/* =========================
   TYPES
========================= */
type FeedbackType = 'feedback' | 'feature';

interface Submission {
  type: FeedbackType;
  message: string;
  contact?: string;
  timestamp?: string;
}

/* =========================
   COMPONENT
========================= */
export const BetaFeedbackBanner = () => {
  const [activeTab, setActiveTab] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);

  // Color schemes for each type
  const colors = {
    feedback: {
      bg: 'bg-teal-50',
      bgHover: 'hover:bg-teal-100',
      border: 'border-teal-200',
      borderActive: 'border-teal-500',
      text: 'text-teal-700',
      textDark: 'text-teal-900',
      accent: 'bg-teal-500',
      accentHover: 'hover:bg-teal-600',
      ring: 'focus:ring-teal-500',
      badge: 'bg-teal-100 text-teal-700 border-teal-200',
    },
    feature: {
      bg: 'bg-violet-50',
      bgHover: 'hover:bg-violet-100',
      border: 'border-violet-200',
      borderActive: 'border-violet-500',
      text: 'text-violet-700',
      textDark: 'text-violet-900',
      accent: 'bg-violet-500',
      accentHover: 'hover:bg-violet-600',
      ring: 'focus:ring-violet-500',
      badge: 'bg-violet-100 text-violet-700 border-violet-200',
    },
  };

  const currentColors = colors[activeTab];

  // Fetch submissions from published Google Sheet
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (GOOGLE_SHEET_CSV_URL === 'YOUR_PUBLISHED_SHEET_CSV_URL') {
        // Demo data when not configured
        setSubmissions([
          { type: 'feature', message: 'Add support for batch compression of multiple files at once', contact: 'Alex' },
          { type: 'feedback', message: 'Love how fast this is! The privacy-first approach is exactly what I needed.', contact: '' },
          { type: 'feature', message: 'Would be great to have a dark mode option', contact: 'Sam' },
        ]);
        setIsLoadingSubmissions(false);
        return;
      }

      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const csv = await response.text();
        const rows = csv.split('\n').slice(1); // Skip header row

        // Parse CSV properly (handles quoted fields with commas)
        const parseCSVRow = (row: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const parsed: Submission[] = rows
          .filter(row => row.trim())
          .flatMap(row => {
            const cols = parseCSVRow(row);
            // Columns: Timestamp, Contact, Feedback, Feature Request
            const timestamp = cols[0] || '';
            const contact = cols[1] || '';
            const feedbackMsg = cols[2] || '';
            const featureMsg = cols[3] || '';

            const submissions: Submission[] = [];

            // Create submission for feedback if it exists
            if (feedbackMsg) {
              submissions.push({
                timestamp,
                type: 'feedback',
                message: feedbackMsg,
                contact,
              });
            }

            // Create submission for feature request if it exists
            if (featureMsg) {
              submissions.push({
                timestamp,
                type: 'feature',
                message: featureMsg,
                contact,
              });
            }

            return submissions;
          })
          .reverse(); // Most recent first

        setSubmissions(parsed);
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
      } finally {
        setIsLoadingSubmissions(false);
      }
    };

    fetchSubmissions();
  }, []);

  // Submit to Google Form
  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append(FORM_FIELDS.contact, contact);

      // Submit to the appropriate field based on active tab
      if (activeTab === 'feedback') {
        formData.append(FORM_FIELDS.feedback, message);
      } else {
        formData.append(FORM_FIELDS.feature, message);
      }

      // Submit to Google Form (no-cors mode since Google Forms don't return CORS headers)
      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });

      // Add to local state for immediate feedback
      setSubmissions(prev => [
        { type: activeTab, message, contact },
        ...prev,
      ]);

      setIsSubmitted(true);
      setMessage('');
      setContact('');

      // Reset after 3 seconds
      setTimeout(() => setIsSubmitted(false), 3000);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedSubmissions = isExpanded ? submissions : submissions.slice(0, 2);

  return (
    <div className="w-full mb-8">
      {/* Beta Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-violet-600 via-purple-600 to-teal-500 rounded-xl p-1 shadow-lg"
      >
        <div className="bg-white/95 backdrop-blur rounded-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="w-6 h-6 text-violet-500" />
            </motion.div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent">
              You&apos;re Part of the Beta!
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-violet-500 to-teal-500 text-white rounded-full">
              BETA
            </span>
          </div>

          <p className="text-center text-slate-600 mb-6 max-w-lg mx-auto">
            Help shape the future of PDF Compress. Your feedback directly influences what we build next.
          </p>

          {/* Tab Switch */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setActiveTab('feedback')}
                className={twMerge(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  activeTab === 'feedback'
                    ? 'bg-white shadow-sm text-teal-700'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
              <button
                onClick={() => setActiveTab('feature')}
                className={twMerge(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  activeTab === 'feature'
                    ? 'bg-white shadow-sm text-violet-700'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Lightbulb className="w-4 h-4" />
                Feature Request
              </button>
            </div>
          </div>

          {/* Success Message */}
          <AnimatePresence mode="wait">
            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className={twMerge(
                    'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
                    currentColors.accent
                  )}
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className={twMerge('text-lg font-bold mb-2', currentColors.textDark)}>
                  Thank You!
                </h3>
                <p className="text-slate-600">
                  Your {activeTab === 'feature' ? 'feature request' : 'feedback'} helps us build a better tool.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Form */}
                <div className="max-w-lg mx-auto space-y-4">
                  {/* Contact Field (Optional) */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <label className="text-sm text-slate-600">
                        Name or Email <span className="text-slate-400">(optional)</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="So we can follow up if needed..."
                      className={twMerge(
                        'w-full px-4 py-2.5 rounded-lg border-2 transition-colors duration-200',
                        'bg-white text-slate-900 placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-offset-1',
                        currentColors.border,
                        currentColors.ring
                      )}
                    />
                  </div>

                  {/* Message Field */}
                  <div>
                    <label className={twMerge('block text-sm font-medium mb-2', currentColors.text)}>
                      {activeTab === 'feature' ? 'What feature would you love to see?' : 'What do you think?'}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        activeTab === 'feature'
                          ? 'Describe the feature you have in mind...'
                          : 'Share your thoughts, suggestions, or report issues...'
                      }
                      rows={3}
                      className={twMerge(
                        'w-full px-4 py-3 rounded-lg border-2 transition-colors duration-200 resize-none',
                        'bg-white text-slate-900 placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-offset-1',
                        currentColors.border,
                        currentColors.ring
                      )}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isSubmitting}
                    className={twMerge(
                      'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200',
                      currentColors.accent,
                      currentColors.accentHover,
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send {activeTab === 'feature' ? 'Feature Request' : 'Feedback'}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Submissions */}
          {submissions.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">
                Community Voices
              </h3>

              <div className="space-y-3 max-w-lg mx-auto">
                <AnimatePresence>
                  {displayedSubmissions.map((sub, idx) => (
                    <motion.div
                      key={`${sub.message.slice(0, 20)}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: idx * 0.05 }}
                      className={twMerge(
                        'p-4 rounded-lg border',
                        sub.type === 'feature' ? colors.feature.bg : colors.feedback.bg,
                        sub.type === 'feature' ? colors.feature.border : colors.feedback.border
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={twMerge(
                            'p-1.5 rounded-md',
                            sub.type === 'feature' ? 'bg-violet-200' : 'bg-teal-200'
                          )}
                        >
                          {sub.type === 'feature' ? (
                            <Lightbulb className={twMerge('w-4 h-4', colors.feature.text)} />
                          ) : (
                            <MessageSquare className={twMerge('w-4 h-4', colors.feedback.text)} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={twMerge(
                                'text-xs font-medium px-2 py-0.5 rounded-full border',
                                sub.type === 'feature' ? colors.feature.badge : colors.feedback.badge
                              )}
                            >
                              {sub.type === 'feature' ? 'Feature' : 'Feedback'}
                            </span>
                            {sub.contact && (
                              <span className="text-xs text-slate-500">from {sub.contact}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">{sub.message}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Expand/Collapse */}
                {submissions.length > 2 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        See all {submissions.length} submissions
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoadingSubmissions && submissions.length === 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
              <p className="text-sm text-slate-500 mt-2">Loading community feedback...</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
