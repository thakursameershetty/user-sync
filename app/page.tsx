"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, Users, AlertCircle, ArrowLeft, CheckCircle2, Search, Grid, List, RefreshCw, Plus, CheckSquare, Edit3, ImagePlus, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type StudentData = Record<string, string>;
type QueueItem = { id: string; type: "text" | "image"; content: string; mimeType?: string };

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

  // Default it to your mom's section so she doesn't have to change it!
  const [activeSection, setActiveSection] = useState("Sec-B");

  // Batch Mode States (Now supports mixed media)
  const [queuedItems, setQueuedItems] = useState<QueueItem[]>([]);
  const [stagedStudents, setStagedStudents] = useState<StudentData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // History States
  const [showHistoryPage, setShowHistoryPage] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StudentData[]>([]);
  const [isViewingHistory, setIsViewingHistory] = useState<StudentData | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Search/Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [casteFilter, setCasteFilter] = useState("All");
  const [transportFilter, setTransportFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const triggerHaptic = (style: "light" | "medium" | "heavy" = "light") => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (style === "light") navigator.vibrate(15);
      else if (style === "medium") navigator.vibrate(30);
      else if (style === "heavy") navigator.vibrate([50, 30, 50]);
    }
  };

  const fetchHistory = useCallback(async (isManual = false) => {
    if (isManual) setIsHistoryLoading(true);
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
  }, []);

  useEffect(() => {
    fetchHistory(false);
  }, [fetchHistory]);

  const closeModal = () => {
    setEditingIndex(null);
    setIsViewingHistory(null);
  };

  // --- QUEUE MANAGEMENT ---

  const handleAddTextToQueue = () => {
    if (!inputText.trim()) return;
    triggerHaptic("medium");
    setQueuedItems((prev) => [...prev, { id: Math.random().toString(36).substring(7), type: "text", content: inputText }]);
    setInputText("");
    setErrorMsg("");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    triggerHaptic("medium");
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Extract just the base64 string without the data URL prefix
        const base64String = (reader.result as string).split(',')[1];
        setQueuedItems((prev) => [
          ...prev,
          { id: Math.random().toString(36).substring(7), type: "image", content: base64String, mimeType: file.type }
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  const removeQueueItem = (id: string) => {
    triggerHaptic("light");
    setQueuedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // --- EXTRACTION & SAVING ---

  const handleProcessQueue = async () => {
    if (queuedItems.length === 0) return;
    triggerHaptic("heavy");
    setStatus("extracting");
    setErrorMsg("");

    // Format the payload to match what the backend expects
    const payloadItems = queuedItems.map(item =>
      item.type === "text"
        ? { type: "text", text: item.content }
        : { type: "image", base64: item.content, mimeType: item.mimeType }
    );

    try {
      const response = await fetch('/api/extract-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });
      if (!response.ok) throw new Error("Bulk extraction failed");

      const { data } = await response.json();
      setStagedStudents(data);
      setQueuedItems([]);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMsg("Could not extract data. Check your API key or image sizes.");
    }
  };

  const handleBulkSave = async () => {
    if (stagedStudents.length === 0) return;
    triggerHaptic("heavy");
    setStatus("saving");
    setErrorMsg("");

    try {
      const response = await fetch('/api/save-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataArray: stagedStudents, section: activeSection }),
      });

      if (!response.ok) throw new Error("Bulk save failed");

      await fetchHistory();
      setStagedStudents([]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMsg(error instanceof Error ? error.message : "Could not save to Google Sheets.");
    }
  };

  const handleStagedFieldChange = (key: string, val: string) => {
    if (editingIndex !== null) {
      const updatedStudents = [...stagedStudents];
      updatedStudents[editingIndex] = { ...updatedStudents[editingIndex], [key]: val };
      setStagedStudents(updatedStudents);
    }
  };

  // --- FILTERING ---
  const filteredHistory = sessionHistory
    .filter((student) => {
      // Only show students belonging to the active section
      if (student.section !== activeSection) return false;

      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const nameMatch = student.childName?.toLowerCase().includes(query);
        const fatherMatch = student.fatherName?.toLowerCase().includes(query);
        const motherMatch = student.motherName?.toLowerCase().includes(query);
        const aadhaarMatch = student.childAadhaar?.toLowerCase().includes(query);
        if (!nameMatch && !fatherMatch && !motherMatch && !aadhaarMatch) return false;
      }
      if (casteFilter !== "All" && student.caste?.toUpperCase() !== casteFilter.toUpperCase()) return false;
      if (transportFilter !== "All" && student.transportMode?.toLowerCase() !== transportFilter.toLowerCase()) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") return (a.childName || "").localeCompare(b.childName || "");
      if (sortBy === "name-desc") return (b.childName || "").localeCompare(a.childName || "");
      if (sortBy === "oldest") return sessionHistory.indexOf(b) - sessionHistory.indexOf(a);
      return sessionHistory.indexOf(a) - sessionHistory.indexOf(b);
    });

  const activeModal = editingIndex !== null || isViewingHistory !== null;

  return (
    <main className="min-h-[100dvh] bg-[#F4F5F7] flex flex-col items-center p-4 md:p-8 font-sans">

      {/* ── Header ── */}
      <div className="w-full max-w-xl flex justify-between items-start pt-4 mb-6 px-2">
        <div>
          <h1 className="text-3xl font-extrabold text-[#111418] tracking-tight mb-1">Student Sync</h1>
          <p className="text-[#606A7B] text-sm leading-relaxed max-w-[280px]">
            Batch extract text or images and sync to Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* New Section Selector */}
          <div className="relative">
            <select
              value={activeSection}
              onChange={(e) => { triggerHaptic("light"); setActiveSection(e.target.value); }}
              className="appearance-none bg-white border border-gray-200 text-gray-800 font-bold text-sm rounded-full px-4 py-2.5 pr-8 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="Sec-A">Section A</option>
              <option value="Sec-B">Section B</option>
              <option value="Sec-C">Section C</option>
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* History Button */}
          <button
            onClick={() => { triggerHaptic("medium"); setShowHistoryPage(true); }}
            className="p-2.5 bg-white border border-gray-200 rounded-full shadow-sm active:scale-95 transition-transform text-gray-700 hover:bg-gray-50 flex items-center justify-center relative cursor-pointer"
          >
            <Users className="w-5 h-5" />
            {/* We calculate the count based on filtered history now! */}
            {filteredHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {filteredHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── MAIN CONDITIONAL UI ── */}
      {stagedStudents.length === 0 ? (

        /* --- QUEUE MODE --- */
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-4">
            <textarea
              className="w-full h-40 md:h-48 p-5 bg-[#F9FAFB] border border-gray-100 rounded-[24px] focus:ring-2 focus:ring-black/5 focus:border-gray-300 outline-none resize-none transition-all text-gray-800 text-base leading-relaxed placeholder:text-gray-400"
              placeholder="Paste text message here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => triggerHaptic("light")}
              disabled={status !== "idle"}
            />

            <AnimatePresence>
              {status === "error" && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2 mt-4">
              <label className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-4 px-4 rounded-[20px] transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm md:text-base cursor-pointer shadow-sm">
                <ImagePlus className="w-5 h-5" /> Add Images
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={status !== "idle"} />
              </label>

              <button
                onClick={handleAddTextToQueue}
                disabled={status !== "idle" || !inputText.trim()}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-4 rounded-[20px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] text-sm md:text-base cursor-pointer"
              >
                <Plus className="w-5 h-5" /> Add Text
              </button>
            </div>
          </div>

          {queuedItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <div className="flex justify-between items-center mb-3 px-2">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{queuedItems.length} Items Queued</span>
                <button onClick={() => { triggerHaptic("light"); setQueuedItems([]); }} className="text-xs text-red-500 font-bold cursor-pointer">Clear All</button>
              </div>

              {/* Visual Queue List */}
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none px-2">
                {queuedItems.map((item) => (
                  <div key={item.id} className="relative shrink-0 w-24 h-24 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center overflow-hidden">
                    <button
                      onClick={() => removeQueueItem(item.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {item.type === "image" ? (
                      <img src={`data:${item.mimeType};base64,${item.content}`} alt="Queue" className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="p-3 text-center flex flex-col items-center text-gray-400">
                        <FileText className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-semibold uppercase truncate w-full">Text snippet</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleProcessQueue}
                disabled={status === "extracting"}
                className="w-full mt-2 bg-black text-white font-bold py-4 px-4 rounded-[20px] shadow-lg flex items-center justify-center active:scale-[0.98] cursor-pointer"
              >
                {status === "extracting" ? <Loader2 className="w-6 h-6 animate-spin" /> : `Extract ${queuedItems.length} Items`}
              </button>
            </motion.div>
          )}
        </div>
      ) : (
        /* --- STAGING MODE --- */
        <div className="w-full max-w-xl">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center">
              <CheckSquare className="w-4 h-4 mr-2" /> Review Extracted Data
            </h2>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{stagedStudents.length} Students</span>
          </div>

          <div className="space-y-3 mb-6">
            {stagedStudents.map((student, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                <div>
                  <p className="font-bold text-lg text-gray-900">{student.childName}</p>
                  <p className="text-xs text-gray-500 mt-1">Father: {student.fatherName}</p>
                </div>
                <button
                  onClick={() => { triggerHaptic("light"); setEditingIndex(idx); }}
                  className="p-3 bg-gray-50 rounded-full text-blue-600 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {status === "error" && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <button
              onClick={() => { triggerHaptic("light"); setStagedStudents([]); }}
              className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-4 rounded-[20px] active:bg-gray-50 cursor-pointer"
            >
              Discard Batch
            </button>
            <button
              onClick={handleBulkSave}
              disabled={status === "saving"}
              className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-[20px] shadow-lg flex items-center justify-center active:scale-[0.98] cursor-pointer"
            >
              {status === "saving" ? <Loader2 className="w-6 h-6 animate-spin" /> : "Looks Good, Save All"}
            </button>
          </div>
        </div>
      )}

      {/* ── Slide-Over History Page ── */}
      <AnimatePresence>
        {showHistoryPage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { triggerHaptic("light"); setShowHistoryPage(false); }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F4F5F7] w-full h-full md:max-w-xl md:h-[85dvh] rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden border-t md:border border-gray-100"
            >
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>

              <div className="bg-white px-4 py-4 pt-2 md:pt-6 flex items-center justify-between border-b border-gray-100 shadow-sm z-10 shrink-0">
                <div className="flex items-center">
                  <button onClick={() => { triggerHaptic("light"); setShowHistoryPage(false); }} className="p-2 -ml-2 rounded-full active:bg-gray-100 transition-colors cursor-pointer">
                    <ArrowLeft className="w-6 h-6 text-gray-900" />
                  </button>
                  <h2 className="text-xl font-bold text-gray-900 ml-2">Students</h2>
                </div>
                <button onClick={() => { triggerHaptic("medium"); fetchHistory(true); }} disabled={isHistoryLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F5F7] hover:bg-gray-200 active:scale-95 disabled:opacity-50 transition-all rounded-xl text-xs font-semibold text-gray-700 cursor-pointer">
                  <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} /> Sync Sheets
                </button>
              </div>

              {/* Filters Panel */}
              <div className="bg-white px-4 py-3 border-b border-gray-100 flex flex-col gap-3 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                  <input type="text" placeholder="Search name, parent, Aadhaar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => triggerHaptic("light")} className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                  {searchQuery && <button onClick={() => { triggerHaptic("light"); setSearchQuery(""); }} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 absolute right-2.5 text-gray-500 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="flex gap-2 text-xs items-center overflow-x-auto pb-1 scrollbar-none">
                  <select value={casteFilter} onChange={(e) => { triggerHaptic("light"); setCasteFilter(e.target.value); }} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none cursor-pointer"><option value="All">Caste: All</option><option value="OC">OC</option><option value="BC">BC</option><option value="SC">SC</option><option value="ST">ST</option></select>
                  <select value={transportFilter} onChange={(e) => { triggerHaptic("light"); setTransportFilter(e.target.value); }} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none cursor-pointer"><option value="All">Transport: All</option><option value="Auto">Auto</option><option value="Bus">Bus</option><option value="Parent">Parent</option><option value="Self">Self / Walk</option></select>
                  <select value={sortBy} onChange={(e) => { triggerHaptic("light"); setSortBy(e.target.value); }} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 outline-none cursor-pointer"><option value="newest">Sort: Newest</option><option value="oldest">Sort: Oldest</option><option value="name-asc">Name: A-Z</option><option value="name-desc">Name: Z-A</option></select>
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shrink-0 ml-1">
                    <button onClick={() => { triggerHaptic("light"); setViewMode("list"); }} className={`p-1.5 cursor-pointer transition-colors ${viewMode === "list" ? "bg-black text-white" : "text-gray-500 hover:text-gray-900"}`}><List className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { triggerHaptic("light"); setViewMode("grid"); }} className={`p-1.5 cursor-pointer transition-colors ${viewMode === "grid" ? "bg-black text-white" : "text-gray-500 hover:text-gray-900"}`}><Grid className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>

              {/* History Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-safe">
                {isHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20"><Loader2 className="w-12 h-12 mb-3 animate-spin text-gray-400" /><p>Loading history…</p></div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20"><Users className="w-12 h-12 mb-3 opacity-20" /><p>No matching records found.</p></div>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                    {filteredHistory.map((student, idx) => (
                      <div key={idx} onClick={() => { triggerHaptic("light"); setIsViewingHistory(student); }} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all flex animate-in fade-in duration-200 ${viewMode === "grid" ? "flex-col items-start gap-2" : "flex-row items-center justify-between"}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /><p className="font-bold text-gray-900 truncate text-sm">{student.childName}</p></div>
                          <p className="text-xs text-gray-400 mt-1 truncate font-mono font-medium">Aadhaar: {student.childAadhaar !== "N/A" ? student.childAadhaar : "No Aadhaar"}</p>
                          {viewMode === "grid" && <p className="text-[10px] text-gray-400 mt-0.5 truncate italic">Caste: {student.caste} | {student.transportMode}</p>}
                        </div>
                        {viewMode === "list" && <div className="text-right shrink-0"><span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold uppercase tracking-wider">{student.caste}</span></div>}
                      </div>
                    ))}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { triggerHaptic("light"); closeModal(); }}
            className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/40 backdrop-blur-sm md:p-4"
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full md:max-w-md rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[90dvh]"
            >
              <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>

              <div className="flex justify-between items-center px-6 pb-4 pt-2 md:pt-6 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingIndex !== null ? "Edit Details" : "Student Record"}
                  </h3>
                </div>
                <button onClick={() => { triggerHaptic("light"); closeModal(); }} className="p-2 bg-gray-100 rounded-full active:bg-gray-200 transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {editingIndex !== null ? (
                  Object.entries(stagedStudents[editingIndex]).map(([key, value]) => (
                    <div key={key} className="flex flex-col space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">{FIELD_LABELS[key] ?? key}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleStagedFieldChange(key, e.target.value)}
                        onFocus={() => triggerHaptic("light")}
                        className="w-full text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  ))
                ) : (
                  Object.entries(isViewingHistory || {}).map(([key, value]) => (
                    <div key={key} className="flex flex-col border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 pl-1">{FIELD_LABELS[key] ?? key}</span>
                      <span className={`text-base font-medium pl-1 ${value === "N/A" ? "text-gray-300 italic" : "text-gray-800"}`}>{value}</span>
                    </div>
                  ))
                )}
              </div>

              {editingIndex !== null && (
                <div className="p-4 pb-8 md:pb-6 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0">
                  <button
                    onClick={() => { triggerHaptic("heavy"); closeModal(); }}
                    className="w-full py-4 rounded-2xl font-bold text-white bg-black active:bg-gray-800 transition-colors cursor-pointer"
                  >
                    Done Editing
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
