"use client";

import { useState } from "react";
import type { Note, NoteType } from "@/types";
import { timeAgo } from "@/lib/utils";

const NOTE_TYPES: { value: NoteType; label: string; color: string }[] = [
  { value: "general", label: "General", color: "text-[hsl(var(--foreground))]" },
  { value: "bull_case", label: "Bull Case", color: "text-bullish" },
  { value: "bear_case", label: "Bear Case", color: "text-bearish" },
  { value: "catalyst", label: "Catalyst", color: "text-[hsl(var(--accent))]" },
  { value: "admin_thesis", label: "Admin Thesis", color: "text-neutral" },
];

export function NotesSection({
  symbol,
  initialNotes,
}: {
  symbol: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [saving, setSaving] = useState(false);

  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const regularNotes = notes.filter((n) => !n.is_pinned);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, note_type: noteType, content }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes([newNote, ...notes]);
        setContent("");
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label mb-0">◆ NOTES</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] font-mono font-bold text-[hsl(var(--accent))] tracking-wider"
        >
          {isOpen ? "CANCEL" : "+ ADD NOTE"}
        </button>
      </div>

      {/* New note form */}
      {isOpen && (
        <div className="card-interactive mb-3 space-y-3 animate-slide-up">
          <div className="flex gap-1.5 flex-wrap">
            {NOTE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setNoteType(t.value)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider rounded-md border transition-colors ${
                  noteType === t.value
                    ? "border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note..."
            className="w-full bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-[hsl(var(--accent))]/40 min-h-[80px]"
          />
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="w-full py-2.5 bg-[hsl(var(--accent))] text-white text-xs font-mono font-bold tracking-wider rounded-lg disabled:opacity-40 transition-opacity"
          >
            {saving ? "SAVING..." : "SAVE NOTE"}
          </button>
        </div>
      )}

      {/* Pinned notes */}
      {pinnedNotes.map((note) => (
        <NoteCard key={note.id} note={note} isPinned />
      ))}

      {/* Regular notes */}
      {regularNotes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}

      {notes.length === 0 && !isOpen && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">
          No notes yet. Add one to share your thesis.
        </p>
      )}
    </section>
  );
}

function NoteCard({ note, isPinned }: { note: Note; isPinned?: boolean }) {
  const typeInfo = NOTE_TYPES.find((t) => t.value === note.note_type) ?? NOTE_TYPES[0];

  return (
    <div className={`card-interactive mb-2 ${isPinned ? "border-neutral/30" : ""}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isPinned && (
            <span className="text-[9px] font-mono bg-neutral/15 text-neutral px-1.5 py-0.5 rounded">
              📌 PINNED
            </span>
          )}
          <span className={`text-[10px] font-mono font-bold tracking-wider ${typeInfo.color}`}>
            {typeInfo.label.toUpperCase()}
          </span>
        </div>
        <span suppressHydrationWarning className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {note.user_name} · {timeAgo(note.created_at)}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{note.content}</p>
    </div>
  );
}
