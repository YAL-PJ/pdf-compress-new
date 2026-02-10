import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Activity, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ProcessingLog } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";

interface ActivityLogProps {
    logs: ProcessingLog[];
    className?: string;
}

export const ActivityLog = ({ logs, className }: ActivityLogProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // Single-pass count instead of 3 separate filter() calls
    const { errorCount, warningCount } = useMemo(() => {
        let errors = 0;
        let warnings = 0;
        for (const l of logs) {
            if (l.level === 'error') errors++;
            else if (l.level === 'warning') warnings++;
        }
        return { errorCount: errors, warningCount: warnings };
    }, [logs]);

    return (
        <div className={twMerge("border border-slate-200 rounded-lg overflow-hidden bg-white", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-md">
                        <Activity className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Processing Activity Log</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            {logs.length} events • {errorCount > 0 ? `${errorCount} errors` : 'No errors'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {errorCount > 0 && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">{errorCount} Errors</span>}
                    {warningCount > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">{warningCount} Warnings</span>}
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100"
                    >
                        <div className="p-4 bg-slate-50/50 max-h-[400px] overflow-y-auto space-y-2">
                            {logs.map((log, index) => (
                                <div key={`${log.timestamp}-${index}`} className="flex gap-3 text-xs group">
                                    <div className="w-16 flex-shrink-0 text-slate-400 font-mono text-[10px] pt-0.5">
                                        {format(log.timestamp, "HH:mm:ss.SSS")}
                                    </div>
                                    <div className="pt-0.5">
                                        {log.level === 'success' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                                        {log.level === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                                        {log.level === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                        {log.level === 'info' && <Info className="w-3 h-3 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={twMerge(
                                            "font-medium",
                                            log.level === 'error' ? "text-red-700" :
                                                log.level === 'warning' ? "text-amber-700" :
                                                    log.level === 'success' ? "text-emerald-700" :
                                                        "text-slate-700"
                                        )}>
                                            {log.message}
                                        </p>
                                        {log.details && (
                                            <pre className="mt-1 text-[10px] bg-slate-100 p-2 rounded border border-slate-200 overflow-x-auto text-slate-600">
                                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {logs.length === 0 && (
                                <div className="text-center text-slate-400 py-4 italic">No logs recorded</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
