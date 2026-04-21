"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Candidate {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  linkedinUrl: string; headline: string; location: string; currentTitle: string;
  currentCompany: string; source: string; persona: string; roleRelevance: string;
  currentStatus: string; currentStage: string; dqReason: string; notes: string; createdAt: string;
}
interface HistoryEntry { id: number; stage: string; status: string; interviewer: string; notes: string; rating: string; createdAt: string; }
interface FeedbackEntry { id: number; roundKey: string; transcript: string; analysis: string; rating: number; interviewer: string; createdAt: string; }
interface Round { roundKey: string; roundName: string; sortOrder: number; enabled: boolean; }

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Strong No-Go", color: "bg-red-100 text-red-800" },
  2: { label: "No Go", color: "bg-amber-100 text-amber-800" },
  3: { label: "Go", color: "bg-green-100 text-green-800" },
  4: { label: "Strong Go", color: "bg-emerald-100 text-emerald-800" },
};

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dqReason, setDqReason] = useState("");
  const [showDq, setShowDq] = useState(false);
  const [interviewer, setInterviewer] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ roundKey: "", date: "", time: "", interviewerEmail: "" });
  const [scheduling, setScheduling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.candidate) setCandidate(data.candidate);
        if (data.history) setHistory(data.history);
        if (data.feedback) setFeedback(data.feedback);
        if (data.rounds) setRounds(data.rounds);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const moveToNextStage = async () => {
    if (!candidate) return;
    const currentIdx = rounds.findIndex((r) => r.roundKey === candidate.currentStage);
    const nextRound = rounds[currentIdx + 1];
    if (!nextRound) return;
    await fetch(`/api/candidates/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move_stage", stage: nextRound.roundKey, status: "In Progress", interviewer }),
    });
    load();
  };

  const handleDq = async () => {
    await fetch(`/api/candidates/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dq", stage: candidate?.currentStage, reason: dqReason }),
    });
    setShowDq(false);
    load();
  };

  const handleTranscriptUpload = async (file: File, roundKey: string) => {
    setAnalyzing(true);
    const transcript = await file.text();
    try {
      const res = await fetch(`/api/candidates/${id}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundKey, transcript, interviewer }),
      });
      const data = await res.json();
      if (!data.error) load();
    } catch {}
    setAnalyzing(false);
  };

  const handleSchedule = async () => {
    if (!candidate || !scheduleForm.roundKey || !scheduleForm.date || !scheduleForm.time || !scheduleForm.interviewerEmail) return;
    setScheduling(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: id,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          candidateEmail: candidate.email,
          roundKey: scheduleForm.roundKey,
          interviewerEmails: [scheduleForm.interviewerEmail],
          interviewerName: interviewer,
          date: scheduleForm.date,
          time: scheduleForm.time,
        }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { setShowSchedule(false); load(); }
    } catch { alert("Scheduling failed"); }
    setScheduling(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }
  if (!candidate) {
    return <div className="text-center py-20 text-slate-500">Candidate not found</div>;
  }

  const currentRoundIdx = rounds.findIndex((r) => r.roundKey === candidate.currentStage);
  const nextRound = currentRoundIdx >= 0 ? rounds[currentRoundIdx + 1] : rounds[0];
  const isDqed = candidate.currentStatus === "DQ'ed";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="text-xs text-slate-400 hover:text-slate-600 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-slate-900">{candidate.firstName} {candidate.lastName}</h1>
          <p className="text-slate-500 mt-1">{candidate.currentTitle}{candidate.currentCompany ? ` at ${candidate.currentCompany}` : ""}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {candidate.location && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{candidate.location}</span>}
            {candidate.persona && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{candidate.persona}</span>}
            {candidate.source && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{candidate.source}</span>}
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              candidate.currentStatus === "DQ'ed" ? "bg-red-100 text-red-700"
              : candidate.currentStatus === "Offer" ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-100 text-blue-700"
            }`}>{candidate.currentStatus}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {candidate.linkedinUrl && (
            <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">LinkedIn</a>
          )}
          {candidate.email && (
            <a href={`mailto:${candidate.email}`} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">{candidate.email}</a>
          )}
          {candidate.phone && (
            <span className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs">{candidate.phone}</span>
          )}
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Interview Pipeline</h2>
          <div className="flex gap-2 items-center">
            <input type="text" value={interviewer} onChange={(e) => setInterviewer(e.target.value)}
              placeholder="Interviewer name" className="px-2 py-1 border rounded text-xs w-36" />
            {!isDqed && (
              <button onClick={() => setShowSchedule(!showSchedule)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100">
                Schedule
              </button>
            )}
            {!isDqed && nextRound && (
              <button onClick={moveToNextStage}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                Move to {nextRound.roundName}
              </button>
            )}
            {!isDqed && (
              <button onClick={() => setShowDq(!showDq)}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium hover:bg-red-100">
                DQ
              </button>
            )}
          </div>
        </div>
        {showDq && (
          <div className="flex gap-2 mb-3 bg-red-50 p-3 rounded-lg">
            <input type="text" value={dqReason} onChange={(e) => setDqReason(e.target.value)}
              placeholder="DQ reason..." className="flex-1 px-3 py-1.5 border rounded text-sm" />
            <button onClick={handleDq} disabled={!dqReason}
              className="px-4 py-1.5 bg-red-600 text-white rounded text-sm font-medium disabled:opacity-50">Confirm DQ</button>
          </div>
        )}
        {showSchedule && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3 space-y-3">
            <p className="text-xs font-semibold text-blue-800">Schedule Interview</p>
            <div className="grid grid-cols-2 gap-3">
              <select value={scheduleForm.roundKey} onChange={(e) => setScheduleForm({ ...scheduleForm, roundKey: e.target.value })}
                className="px-3 py-2 border rounded-lg text-xs">
                <option value="">Select round...</option>
                {rounds.map((r) => <option key={r.roundKey} value={r.roundKey}>{r.roundName}</option>)}
              </select>
              <input type="email" value={scheduleForm.interviewerEmail} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewerEmail: e.target.value })}
                placeholder="Interviewer email" className="px-3 py-2 border rounded-lg text-xs" />
              <input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                className="px-3 py-2 border rounded-lg text-xs" />
              <input type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                className="px-3 py-2 border rounded-lg text-xs" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSchedule} disabled={scheduling || !scheduleForm.roundKey || !scheduleForm.date || !scheduleForm.time || !scheduleForm.interviewerEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                {scheduling ? "Scheduling..." : "Send Calendar Invite"}
              </button>
              <button onClick={() => setShowSchedule(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs">Cancel</button>
            </div>
          </div>
        )}
        {isDqed && candidate.dqReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <span className="text-xs text-red-600 font-medium">DQ Reason:</span>
            <span className="text-xs text-red-800 ml-2">{candidate.dqReason}</span>
          </div>
        )}
        {/* Stage indicators */}
        <div className="flex gap-1">
          {rounds.map((r, i) => {
            const isCurrentOrPast = currentRoundIdx >= 0 ? i <= currentRoundIdx : false;
            const isCurrent = r.roundKey === candidate.currentStage;
            const roundFeedback = feedback.find((f) => f.roundKey === r.roundKey);
            const ratingInfo = roundFeedback ? RATING_LABELS[roundFeedback.rating] : null;

            return (
              <button key={r.roundKey} onClick={() => setActiveRound(activeRound === r.roundKey ? null : r.roundKey)}
                className={`flex-1 py-2 px-2 rounded text-xs font-medium transition-all text-center border ${
                  isCurrent ? "bg-indigo-600 text-white border-indigo-600"
                  : isCurrentOrPast && ratingInfo ? `${ratingInfo.color} border-transparent`
                  : isCurrentOrPast ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
                }`}>
                <div>{r.roundName.split("(")[0].trim()}</div>
                {roundFeedback && <div className="text-[10px] mt-0.5">{roundFeedback.rating}/4</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Round Detail — transcript upload + analysis */}
      {activeRound && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            {rounds.find((r) => r.roundKey === activeRound)?.roundName}
          </h3>
          {/* Upload transcript */}
          <div className="flex gap-2 items-center mb-4">
            <input ref={fileRef} type="file" accept=".txt,.vtt,.srt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTranscriptUpload(f, activeRound); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} disabled={analyzing}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 disabled:opacity-50">
              {analyzing ? "Analyzing..." : "Upload Interview Transcript"}
            </button>
          </div>
          {/* Show feedback if exists */}
          {feedback.filter((f) => f.roundKey === activeRound).map((fb) => {
            let parsed: any = {};
            try { parsed = JSON.parse(fb.analysis); } catch { parsed = { detailed: fb.analysis }; }
            const rInfo = RATING_LABELS[fb.rating];
            return (
              <div key={fb.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  {rInfo && <span className={`px-3 py-1 rounded text-sm font-bold ${rInfo.color}`}>{fb.rating}/4 — {rInfo.label}</span>}
                  {fb.interviewer && <span className="text-xs text-slate-500">by {fb.interviewer}</span>}
                  <span className="text-xs text-slate-400">{fb.createdAt}</span>
                </div>
                {parsed.summary && <p className="text-sm font-medium text-slate-800">{parsed.summary}</p>}
                {parsed.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                    <ul className="text-xs text-green-800 space-y-0.5">{parsed.strengths.map((s: string, i: number) => <li key={i}>+ {s}</li>)}</ul>
                  </div>
                )}
                {parsed.concerns?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">Concerns</p>
                    <ul className="text-xs text-red-800 space-y-0.5">{parsed.concerns.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
                  </div>
                )}
                {parsed.detailed && <p className="text-sm text-slate-600 whitespace-pre-wrap">{parsed.detailed}</p>}
              </div>
            );
          })}
          {feedback.filter((f) => f.roundKey === activeRound).length === 0 && (
            <p className="text-xs text-slate-400 italic">No feedback yet. Upload a transcript to get AI analysis.</p>
          )}
        </div>
      )}

      {/* Stage History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">History</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-xs border-b border-slate-100 pb-2">
                <span className="text-slate-400 w-32">{h.createdAt}</span>
                <span className="font-medium text-slate-700">{h.stage}</span>
                <span className={`px-2 py-0.5 rounded ${
                  h.status === "DQ'ed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                }`}>{h.status}</span>
                {h.interviewer && <span className="text-slate-400">by {h.interviewer}</span>}
                {h.notes && <span className="text-slate-500 truncate max-w-[200px]">{h.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
