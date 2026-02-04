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
        className="bg-slate-900 text-white shadow-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10">
            {/* Left: Beta Badge + Message */}
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-slate-900 rounded tracking-wider">
                BETA
              </span>
              <span className="text-sm text-slate-300 hidden sm:inline">
                Building this with you! Please help us improve 🚀
              </span>
              <span className="text-sm text-slate-300 sm:hidden">
                Help us improve 🚀
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span className="hidden sm:inline">Collapse</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3 h-3" />
                    <span className="hidden sm:inline">Give Feedback</span>
                    <span className="sm:hidden">Feedback</span>
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
            className="bg-slate-50 border-b border-slate-200 shadow-lg overflow-hidden"
          >
            <div className="max-w-2xl mx-auto px-4 py-4">
              {/* Success State */}
              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-center gap-3 py-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      Thanks for your {activeTab === 'feature' ? 'feature request' : 'feedback'}!
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Tab Switch */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setActiveTab('feedback')}
                        className={twMerge(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                          activeTab === 'feedback'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
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
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
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
                        className="sm:w-40 px-3 py-2 text-sm rounded border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
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
                            ? 'Describe the feature you want...'
                            : 'Share your thoughts or report issues...'
                        }
                        className="flex-1 px-3 py-2 text-sm rounded border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
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
