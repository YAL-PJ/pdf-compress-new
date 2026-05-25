'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Check, ChevronUp, Loader2, Lock } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { XLogoLink } from '@/components/XLogoLink';

/* =========================
   CONFIGURATION
========================= */
// Paste the deployed Apps Script /exec URL here. See google-apps-script/feedback-backend.gs
const FEEDBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzgIwblyMQv4O8GypUMT7xfj8Xkv6W2oyCFxZVcUExwpWhHr_7WWXQlvi2tfzjXisu4Ww/exec';
const APP_ID = 'compresspdf';
const OWNER_NAME = 'Yanis (creator)';

const SISTER_APPS = [
  { label: 'Merge PDFs', host: 'FreeMergePDF', url: 'https://freemergepdf.com/' },
  { label: 'Convert to PDF', host: 'ConvertToPDFFree', url: 'https://converttopdffree.com/' },
  { label: 'Split PDFs', host: 'SplitPDFFree', url: 'https://splitpdffree.com/' },
];

/* =========================
   TYPES
========================= */
type FeedbackEntry = {
  id: string;
  timestamp: string;
  app: string;
  name: string;
  message: string;
  isPrivate: boolean;
  ownerReply: string;
  ownerReplyDate: string;
};

/* =========================
   COMPONENT
========================= */
export const BetaFeedbackBanner = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [showAll, setShowAll] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!FEEDBACK_ENDPOINT) return;
    try {
      const res = await fetch(`${FEEDBACK_ENDPOINT}?app=${encodeURIComponent(APP_ID)}`, { cache: 'no-store' });
      const json = await res.json();
      const list = Array.isArray(json) ? json : [];
      list.sort((a: FeedbackEntry, b: FeedbackEntry) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setEntries(list.filter((it: FeedbackEntry) => it.message));
    } catch (err) {
      console.warn('feedback load failed', err);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) fetchEntries();
  }, [isExpanded, fetchEntries]);

  const handleSubmit = async () => {
    if (website) return; // honeypot
    if (isSubmitting) return;

    setError(null);
    const trimmed = message.trim();
    const emailTrim = email.trim();
    if (trimmed.length < 5) { setError('Tell us a bit more — at least a few words.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) { setError('Please enter a valid email so we can reply.'); return; }
    if (!FEEDBACK_ENDPOINT) { setError('Feedback endpoint not configured yet.'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ app: APP_ID, name: name.trim(), email: emailTrim, message: trimmed, isPrivate }),
      });
      const json = await res.json().catch(() => ({}));
      if (json && json.ok === false) throw new Error(json.error || 'submit failed');

      setIsSubmitted(true);
      setMessage('');
      setEmail('');
      setName('');
      setIsPrivate(false);
      setTimeout(() => { setIsSubmitted(false); setIsExpanded(false); }, 2500);
      setTimeout(fetchEntries, 1500);
    } catch (err) {
      console.error('feedback submit failed', err);
      setError('Could not send. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleEntries = showAll ? entries : entries.slice(0, 2);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Collapsed Bar */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/30 backdrop-blur-sm text-slate-900 border-b border-slate-300 relative z-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10">
            {/* Left: Sister apps */}
            <div className="flex items-center gap-3 text-sm text-slate-600 overflow-x-auto whitespace-nowrap">
              <span className="hidden sm:inline">More tools by Yanis:</span>
              {SISTER_APPS.map((app) => (
                <a
                  key={app.url}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700 transition-colors"
                >
                  {app.label}
                </a>
              ))}
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
                    <MessageSquare className="w-3 h-3" />
                    <span>Feedback</span>
                  </>
                )}
              </button>
              <XLogoLink className="hidden sm:inline text-slate-600 hover:text-slate-900 transition-colors" />
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
            className="bg-white/30 backdrop-blur-sm border-b border-slate-300 overflow-hidden relative z-10"
          >
            <div className="max-w-2xl mx-auto px-4 py-4">
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
                      <p className="text-slate-500 text-sm">We&apos;re listening and improving.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Honeypot */}
                    <div className="absolute -left-[10000px] w-px h-px overflow-hidden" aria-hidden="true">
                      <label htmlFor="bfb-website">Website</label>
                      <input id="bfb-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="px-3 py-2 text-sm rounded border border-slate-300 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name (optional)"
                        className="px-3 py-2 text-sm rounded border border-slate-300 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                      />
                    </div>

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
                      placeholder="What's working? What's broken? What's missing?"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border border-slate-300 bg-white/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 resize-y"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-3.5 h-3.5" />
                        <Lock className="w-3 h-3" />
                        Keep this private
                      </label>

                      {error && <span className="text-xs text-red-600">{error}</span>}

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
                            <span>Send</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Recent Community Input */}
                    {entries.length > 0 && (
                      <div className="pt-4 border-t border-slate-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider bg-white/90 px-2 py-1 rounded">
                            Recent Community Input
                          </h4>
                          {entries.length > 2 && (
                            <button
                              onClick={() => setShowAll(!showAll)}
                              className="text-[10px] font-medium text-slate-600 hover:text-slate-800 transition-colors bg-white/90 px-2 py-1 rounded"
                            >
                              {showAll ? 'Show Less' : `See All (${entries.length})`}
                            </button>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {visibleEntries.map((entry) => {
                            const when = entry.timestamp ? new Date(entry.timestamp) : null;
                            const dateText = when && !isNaN(when.getTime()) ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                            const displayName = entry.name && entry.name.trim() ? entry.name : 'Anonymous';
                            return (
                              <div key={entry.id} className="bg-white/90 p-3 rounded border border-slate-300 text-xs space-y-2">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <MessageSquare className="w-3 h-3 text-blue-500" />
                                  <span>{displayName}</span>
                                  {dateText && <><span>·</span><span>{dateText}</span></>}
                                </div>
                                <p className="text-slate-700 whitespace-pre-wrap">&ldquo;{entry.message}&rdquo;</p>
                                {entry.ownerReply && (
                                  <div className="mt-2 p-2 rounded bg-slate-50 border-l-2 border-slate-900">
                                    <div className="text-[10px] font-semibold text-slate-900 uppercase tracking-wider mb-1">
                                      Reply from {OWNER_NAME}
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-wrap">{entry.ownerReply}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
