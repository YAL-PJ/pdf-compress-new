'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYkc_ORMeBD68CZErjqvblL73Ph4wuwGlDyP9kyidZpTEUyTGMhJkWehM4S-W3lNtht7nClqozYt1x/pub?gid=1952833366&single=true&output=csv';

// Google Form field entry IDs
const FORM_FIELDS = {
  contact: 'entry.1428967819',
  feedback: 'entry.590651661',
  feature: 'entry.1118737533',
};

/* =========================
   TYPES
========================= */
type FeedbackType = 'feedback' | 'feature';

/* =========================
   COMPONENT
========================= */
export const BetaFeedbackBanner = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [recentFeedback, setRecentFeedback] = useState<Array<{ text: string, type: FeedbackType, date: string }>>([]);
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const csvText = await response.text();

        // Simple CSV parser that handles quotes
        const parseCSV = (text: string) => {
          const lines = text.split('\n');
          return lines.slice(1).map(line => {
            const matches = [];
            let inQuote = false;
            let current = '';

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuote = !inQuote;
              } else if (char === ',' && !inQuote) {
                matches.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            matches.push(current.trim());
            return matches;
          });
        };

        const rows = parseCSV(csvText);
        const validFeeedback = rows
          .map(row => {
            // Row format: Timestamp, Name, Feedback, Feature
            const feedback = row[2]?.replace(/^"|"$/g, '').replace(/""/g, '"');
            const feature = row[3]?.replace(/^"|"$/g, '').replace(/""/g, '"');
            const date = row[0]?.split(' ')[0]; // Just the date part

            if (feedback) return { text: feedback, type: 'feedback' as FeedbackType, date };
            if (feature) return { text: feature, type: 'feature' as FeedbackType, date };
            return null;
          })
          .filter((item): item is { text: string, type: FeedbackType, date: string } =>
            item !== null && item.text.length > 0 && item.text.length < 150 // Filter out very long ones
          )
          .reverse(); // Show newest first

        setRecentFeedback(validFeeedback);
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
      }
    };

    if (isExpanded) {
      fetchFeedback();
    }
  }, [isExpanded]);

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append(FORM_FIELDS.contact, contact);

      if (activeTab === 'feedback') {
        formData.append(FORM_FIELDS.feedback, message);
      } else {
        formData.append(FORM_FIELDS.feature, message);
      }

      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });

      setIsSubmitted(true);
      setMessage('');
      setContact('');

      // Reset after 3 seconds and collapse
      setTimeout(() => {
        setIsSubmitted(false);
        setIsExpanded(false);
      }, 2500);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };




  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Collapsed Bar */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/30 text-slate-900 border-b border-slate-300 relative z-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10">
            {/* Left: Beta Badge + Message */}
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-900 text-white rounded tracking-wider">
                BETA
              </span>
              <span className="text-sm text-slate-600 hidden sm:inline">
                Building this with our users community! Please help us improve 🚀
              </span>
              <span className="text-sm text-slate-600 sm:hidden">
                Help us improve 🚀
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 rounded transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>Expand</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white/30 border-b border-slate-300 overflow-hidden relative z-10"
          >
            <div className="max-w-2xl mx-auto px-4 py-4">
              {/* Success State */}
              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-center gap-3 py-8"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-slate-900 font-medium">Thanks for your input!</h4>
                      <p className="text-slate-500 text-sm">We're listening and improving.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Input Area */}
                    <div>
                      {/* Tab Switch */}
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setActiveTab('feedback')}
                          className={twMerge(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            activeTab === 'feedback'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white/90 border border-slate-300 text-slate-600 hover:border-slate-500'
                          )}
                        >
                          <MessageSquare className="w-3 h-3" />
                          Feedback
                        </button>
                        <button
                          onClick={() => setActiveTab('feature')}
                          className={twMerge(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                            activeTab === 'feature'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white/90 border border-slate-300 text-slate-600 hover:border-slate-500'
                          )}
                        >
                          <Lightbulb className="w-3 h-3" />
                          Feature Request
                        </button>
                      </div>

                      {/* Compact Form */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="Name/Email (optional)"
                          className="sm:w-40 px-3 py-2 text-sm rounded border border-slate-300 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                        />
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && message.trim()) {
                              handleSubmit();
                            }
                          }}
                          placeholder={
                            activeTab === 'feature'
                              ? 'I wish this app could...'
                              : 'Something is not working...'
                          }
                          className="flex-1 px-3 py-2 text-sm rounded border border-slate-300 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                        />
                        <button
                          onClick={handleSubmit}
                          disabled={!message.trim() || isSubmitting}
                          className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Send</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Community Feedback Ticker */}
                    {recentFeedback.length > 0 && (
                      <div className="pt-4 border-t border-slate-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider bg-white/90 px-2 py-1 rounded">
                            Recent Community Input
                          </h4>
                          {recentFeedback.length > 2 && (
                            <button
                              onClick={() => setShowAllFeedback(!showAllFeedback)}
                              className="text-[10px] font-medium text-slate-600 hover:text-slate-800 transition-colors bg-white/90 px-2 py-1 rounded"
                            >
                              {showAllFeedback ? 'Show Less' : `See All (${recentFeedback.length})`}
                            </button>
                          )}
                        </div>
                        <div className={`grid gap-2 ${showAllFeedback ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
                          {recentFeedback
                            .slice(0, showAllFeedback ? undefined : 2)
                            .map((item, i) => (
                              <div key={i} className="bg-white/90 p-3 rounded border border-slate-300 text-xs">
                                <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
                                  {item.type === 'feature' ? (
                                    <Lightbulb className="w-3 h-3 text-amber-500" />
                                  ) : (
                                    <MessageSquare className="w-3 h-3 text-blue-500" />
                                  )}
                                  <span className="capitalize">{item.type}</span>
                                  <span>•</span>
                                  <span>{item.date}</span>
                                </div>
                                <p className="text-slate-700">"{item.text}"</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
