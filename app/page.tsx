"use client";

import { useState, useEffect } from "react";
import { Loader2, X, Users, AlertTriangle, AlertCircle, ArrowLeft, CheckCircle2, Search, Grid, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type StudentData = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  childName: "Child Name",
  dob: "Date of Birth",
  caste: "Caste (OC/BC/SC)",
  childAadhaar: "Child Aadhaar",
  fatherName: "Father Name",
  fatherContact: "Father Contact",
  fatherWhatsapp: "Father WhatsApp",
  fatherAadhaar: "Father Aadhaar",
  motherName: "Mother Name",
  motherContact: "Mother Contact",
  motherWhatsapp: "Mother WhatsApp",
  motherAadhaar: "Mother Aadhaar",
  address: "Address",
  transportMode: "Transport Mode",
  autoDriverName: "Auto Driver Name",
  autoDriverContact: "Driver Contact",
};

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<"idle" | "extracting" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [previewData, setPreviewData] = useState<StudentData | null>(null);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);

  const [showHistoryPage, setShowHistoryPage] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StudentData[]>([]);
  const [isViewingHistory, setIsViewingHistory] = useState<StudentData | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/history');
        if (response.ok) {
          const { data } = await response.json();
          setSessionHistory(data);
        }
      } catch {
        console.error("Failed to load history");
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // Search, Filter, Sorting, and View Switcher states
  const [searchQuery, setSearchQuery] = useState("");
  const [casteFilter, setCasteFilter] = useState("All");
  const [transportFilter, setTransportFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Vibration api trigger helper
  const triggerHaptic = (style: "light" | "medium" | "heavy" = "light") => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (style === "light") {
        navigator.vibrate(15);
      } else if (style === "medium") {
        navigator.vibrate(30);
      } else if (style === "heavy") {
        navigator.vibrate([50, 30, 50]);
      }
    }
  };

  const closeModal = () => {
    setPreviewData(null);
    setIsViewingHistory(null);
    setShowDuplicatePrompt(false);
  };

  // STEP 1 — Send text to Gemini, get structured JSON back
  const handleExtract = async () => {
    if (!inputText.trim()) return;
    setStatus("extracting");
    setErrorMsg("");
    setShowDuplicatePrompt(false);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) throw new Error("Extraction failed");
      const { data } = await response.json();
      setPreviewData(data);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMsg("Could not extract data. Check your Gemini API key and try again.");
    }
  };

  // STEP 2 — Save verified JSON to Google Sheets (handles duplicate check warning)
  const handleConfirmAndSave = async (forceUpdate = false) => {
    if (!previewData) return;
    setStatus("saving");
    setErrorMsg("");

    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: previewData, forceUpdate }),
      });

      const result = await response.json();

      if (result.exists) {
        setShowDuplicatePrompt(true);
        setStatus("idle");
        return;
      }

      if (!response.ok) throw new Error(result.error || "Save failed");

      // Update session history from the sheet (source of truth)
      const updatedHistoryResponse = await fetch('/api/history');
      if (updatedHistoryResponse.ok) {
        const { data } = await updatedHistoryResponse.json();
        setSessionHistory(data);
      }

      setPreviewData(null);
      setShowDuplicatePrompt(false);
      setInputText("");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      const errMsg = error instanceof Error ? error.message : "Could not save to Google Sheets. Check your service account credentials.";
      setErrorMsg(errMsg);
    }
  };

  const handleFieldChange = (key: string, val: string) => {
    if (previewData) {
      setPreviewData({ ...previewData, [key]: val });
    }
  };

  // Filter and Sort implementation
  const filteredHistory = sessionHistory
    .filter((student) => {
      // 1. Search Query
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const nameMatch = student.childName?.toLowerCase().includes(query);
        const fatherMatch = student.fatherName?.toLowerCase().includes(query);
        const motherMatch = student.motherName?.toLowerCase().includes(query);
        const aadhaarMatch = student.childAadhaar?.toLowerCase().includes(query);
        if (!nameMatch && !fatherMatch && !motherMatch && !aadhaarMatch) {
          return false;
        }
      }

      // 2. Caste Filter
      if (casteFilter !== "All") {
        if (student.caste?.toUpperCase() !== casteFilter.toUpperCase()) {
          return false;
        }
      }

      // 3. Transport Filter
      if (transportFilter !== "All") {
        if (student.transportMode?.toLowerCase() !== transportFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // 4. Sorting
      if (sortBy === "name-asc") {
        return (a.childName || "").localeCompare(b.childName || "");
      }
      if (sortBy === "name-desc") {
        return (b.childName || "").localeCompare(a.childName || "");
      }
      if (sortBy === "oldest") {
        const aIdx = sessionHistory.indexOf(a);
        const bIdx = sessionHistory.indexOf(b);
        return bIdx - aIdx;
      }
      // default: newest
      const aIdx = sessionHistory.indexOf(a);
      const bIdx = sessionHistory.indexOf(b);
      return aIdx - bIdx;
    });

  const activeModal = previewData ?? isViewingHistory;

  return (
    <main className="min-h-[100dvh] bg-[#F4F5F7] flex flex-col items-center p-4 md:p-8 font-sans">

      {/* ── Header ── */}
      <div className="w-full max-w-xl flex justify-between items-start pt-4 mb-6 px-2">
        <div>
          <h1 className="text-3xl font-extrabold text-[#111418] tracking-tight mb-1">Student Sync</h1>
          <p className="text-[#606A7B] text-sm leading-relaxed max-w-[280px]">
            Paste a WhatsApp message, review/edit details, then save to Google Sheets.
          </p>
        </div>

        {/* History Toggle Button */}
        <button
          onClick={() => {
            triggerHaptic("medium");
            setShowHistoryPage(true);
          }}
          className="p-3 bg-white border border-gray-200 rounded-full shadow-sm active:scale-95 transition-transform text-gray-700 hover:bg-gray-50 flex items-center justify-center relative cursor-pointer"
        >
          <Users className="w-5 h-5" />
          {sessionHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {sessionHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main Input Card ── */}
      <div className="w-full max-w-xl bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-4">
        <textarea
          className="w-full h-72 md:h-80 p-5 bg-[#F9FAFB] border border-gray-100 rounded-[24px] focus:ring-2 focus:ring-black/5 focus:border-gray-300 outline-none resize-none transition-all text-gray-800 text-base leading-relaxed placeholder:text-gray-400"
          placeholder={`Paste parent's WhatsApp message here…\n\nExample:\nChild Name: Rahul\nDate of birth: 12/05/2015\nCaste: BC…`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => triggerHaptic("light")}
          disabled={status !== "idle"}
        />

        {/* Error Banner */}
        <AnimatePresence>
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            triggerHaptic("medium");
            handleExtract();
          }}
          disabled={status !== "idle" || !inputText.trim()}
          className="mt-4 w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 px-4 rounded-[20px] transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] text-lg shadow-md shadow-black/10 cursor-pointer"
        >
          {status === "extracting" ? (
            <><Loader2 className="w-6 h-6 animate-spin" /> Extracting…</>
          ) : (
            "Extract Details"
          )}
        </button>
      </div>

      {/* ── Slide-Over Students Page (Mobile: Bottom Sheet, Desktop: Centered card) ── */}
      <AnimatePresence>
        {showHistoryPage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              triggerHaptic("light");
              setShowHistoryPage(false);
            }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F4F5F7] w-full h-full md:max-w-xl md:h-[85dvh] rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden border-t md:border border-gray-100"
            >
              {/* Drag Handle Indicator for mobile view */}
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
              </div>

              {/* Slide-over Header */}
              <div className="bg-white px-4 py-4 pt-2 md:pt-6 flex items-center border-b border-gray-100 shadow-sm z-10 shrink-0">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setShowHistoryPage(false);
                  }}
                  className="p-2 -ml-2 rounded-full active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 ml-2">Students</h2>
              </div>

              {/* Search, Filters, Sort, and View switcher Panel */}
              <div className="bg-white px-4 py-3 border-b border-gray-100 flex flex-col gap-3 shrink-0">
                {/* Search Bar */}
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name, parent, Aadhaar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => triggerHaptic("light")}
                    className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        triggerHaptic("light");
                        setSearchQuery("");
                      }}
                      className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 absolute right-2.5 text-gray-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters & Sort options */}
                <div className="flex gap-2 text-xs items-center overflow-x-auto pb-1 scrollbar-none">
                  {/* Caste select */}
                  <select
                    value={casteFilter}
                    onChange={(e) => {
                      triggerHaptic("light");
                      setCasteFilter(e.target.value);
                    }}
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 cursor-pointer"
                  >
                    <option value="All">Caste: All</option>
                    <option value="OC">OC</option>
                    <option value="BC">BC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                  </select>

                  {/* Transport select */}
                  <select
                    value={transportFilter}
                    onChange={(e) => {
                      triggerHaptic("light");
                      setTransportFilter(e.target.value);
                    }}
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 cursor-pointer"
                  >
                    <option value="All">Transport: All</option>
                    <option value="Auto">Auto</option>
                    <option value="Bus">Bus</option>
                    <option value="Parent">Parent</option>
                    <option value="Self">Self / Walk</option>
                  </select>

                  {/* Sort selection */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      triggerHaptic("light");
                      setSortBy(e.target.value);
                    }}
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 cursor-pointer"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="name-asc">Name: A-Z</option>
                    <option value="name-desc">Name: Z-A</option>
                  </select>

                  {/* View switcher */}
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shrink-0 ml-1">
                    <button
                      onClick={() => {
                        triggerHaptic("light");
                        setViewMode("list");
                      }}
                      className={`p-1.5 cursor-pointer transition-colors ${viewMode === "list" ? "bg-black text-white" : "text-gray-500 hover:text-gray-900"
                        }`}
                      title="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic("light");
                        setViewMode("grid");
                      }}
                      className={`p-1.5 cursor-pointer transition-colors ${viewMode === "grid" ? "bg-black text-white" : "text-gray-500 hover:text-gray-900"
                        }`}
                      title="Grid View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* List/Grid Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-safe">
                {isHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
                    <Loader2 className="w-12 h-12 mb-3 animate-spin text-gray-400" />
                    <p>Loading history…</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
                    <Users className="w-12 h-12 mb-3 opacity-20" />
                    <p>No matching records found.</p>
                  </div>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                    {filteredHistory.map((student, idx) => {
                      const originalIdx = sessionHistory.indexOf(student);
                      return (
                        <div
                          key={originalIdx !== -1 ? originalIdx : idx}
                          onClick={() => {
                            triggerHaptic("light");
                            setIsViewingHistory(student);
                          }}
                          className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all flex animate-in fade-in duration-200 ${viewMode === "grid"
                            ? "flex-col items-start gap-2"
                            : "flex-row items-center justify-between"
                            }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              <p className="font-bold text-gray-900 truncate text-sm">{student.childName}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 truncate font-mono font-medium">
                              Aadhaar: {student.childAadhaar !== "N/A" ? student.childAadhaar : "No Aadhaar"}
                            </p>
                            {viewMode === "grid" && (
                              <p className="text-[10px] text-gray-400 mt-0.5 truncate italic">
                                Caste: {student.caste} | {student.transportMode}
                              </p>
                            )}
                          </div>
                          {viewMode === "list" && (
                            <div className="text-right shrink-0">
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold uppercase tracking-wider">
                                {student.caste}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Native Mobile Bottom Sheet Modal ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              triggerHaptic("light");
              closeModal();
            }}
            className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/40 backdrop-blur-sm md:p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full md:max-w-md rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[90dvh]"
            >
              {/* Drag Handle Indicator */}
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
              </div>

              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 pb-4 pt-2 md:pt-6 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {previewData ? "Review Details" : "Student Record"}
                  </h3>
                  {previewData && (
                    <p className="text-xs text-gray-400 mt-0.5">Edit details before saving to sheets</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    closeModal();
                  }}
                  className="p-2 bg-gray-100 rounded-full active:bg-gray-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Scrollable list elements */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {previewData ? (
                  // Edit inputs fields
                  Object.entries(previewData).map(([key, value]) => (
                    <div key={key} className="flex flex-col space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                        {FIELD_LABELS[key] ?? key}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        onFocus={() => triggerHaptic("light")}
                        className="w-full text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  ))
                ) : (
                  // View-only static detail records
                  Object.entries(isViewingHistory || {}).map(([key, value]) => (
                    <div key={key} className="flex flex-col border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">
                        {FIELD_LABELS[key] ?? key}
                      </span>
                      <span className={`text-base font-medium pl-1 ${value === "N/A" ? "text-gray-300 italic" : "text-gray-800"}`}>
                        {value}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Action Footer (Only for preview data) */}
              {previewData && (
                <div className="p-4 pb-8 md:pb-6 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0">
                  {showDuplicatePrompt && (
                    <div className="p-3 mb-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Student Exists!</p>
                        <p className="text-xs font-medium text-amber-700 mt-0.5">
                          A record with the name <strong>&quot;{previewData.childName}&quot;</strong> already exists in Google Sheets. Overwrite existing record?
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => {
                        triggerHaptic("light");
                        closeModal();
                      }}
                      className="w-1/3 py-4 rounded-2xl font-bold text-gray-700 bg-gray-100 active:bg-gray-200 transition-colors text-sm cursor-pointer"
                    >
                      Cancel
                    </button>

                    {showDuplicatePrompt ? (
                      <button
                        onClick={() => {
                          triggerHaptic("heavy");
                          handleConfirmAndSave(true);
                        }}
                        disabled={status === "saving"}
                        className="w-2/3 py-4 rounded-2xl font-bold text-white bg-amber-500 active:bg-amber-600 transition-colors flex justify-center items-center text-sm cursor-pointer"
                      >
                        {status === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Record"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          triggerHaptic("heavy");
                          handleConfirmAndSave(false);
                        }}
                        disabled={status === "saving"}
                        className="w-2/3 py-4 rounded-2xl font-bold text-white bg-blue-600 active:bg-blue-700 transition-colors flex justify-center items-center text-sm cursor-pointer"
                      >
                        {status === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Looks Good, Save"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
