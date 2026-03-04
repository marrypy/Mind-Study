import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStudyData, saveStudyData, id } from '../lib/studyStorage.js';
import { chatCompletion } from '../lib/openai.js';
import { extractTextFromPdf } from '../lib/pdfText.js';
import { publishStudyItem, setPublicItemVisibility } from '../lib/publicLibrary.js';
import { getSubscriptionTier } from '../lib/subscription.js';
import { canCreateStudyItems, recordStudyItems, FREE_ITEM_LIMIT_PER_WEEK } from '../lib/usageLimits.js';
import '../css/Study.css';

export default function Study({
  selectedFolderId = null,
  onSelectFolderId = () => {},
  initialViewingFolderId = null,
  initialViewingItemId = null,
  onOpenItem = () => {},
  onBackFromItem = () => {},
  onAddRecent = () => {},
}) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const subscriptionTier = getSubscriptionTier(user);

  const [folders, setFolders] = useState([]);
  const [itemsByFolder, setItemsByFolder] = useState({});
  const [addFolderName, setAddFolderName] = useState('');
  const [addFolderDescription, setAddFolderDescription] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [createMode, setCreateMode] = useState(null); // 'flashcards' | 'study_guide' | 'practice_test' | null
  const [createModes, setCreateModes] = useState([]); // multi-select: ['flashcards','study_guide','practice_test']
  const [pasteText, setPasteText] = useState('');
  const [flashcardCount, setFlashcardCount] = useState(10);
  const [practiceTestCount, setPracticeTestCount] = useState(10);
  const [studyGuideMode, setStudyGuideMode] = useState('quick'); // 'quick' | 'long'
  const [generated, setGenerated] = useState(null); // single-mode result
  const [generatedByType, setGeneratedByType] = useState({ flashcards: null, study_guide: null, practice_test: null });
  const [saveTitle, setSaveTitle] = useState('');
  const [saveTitlesByType, setSaveTitlesByType] = useState({ flashcards: '', study_guide: '', practice_test: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [testQuestionIndex, setTestQuestionIndex] = useState(0);
  const [testSelected, setTestSelected] = useState(null);
  const [testShowResult, setTestShowResult] = useState(false);
  const [testScore, setTestScore] = useState({ correct: 0, total: 0 });
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [attachedPdfs, setAttachedPdfs] = useState([]); // { id, name, text }[]
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderDescription, setEditFolderDescription] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [lectureFlowFolderId, setLectureFlowFolderId] = useState(null);
  const [pendingLecture, setPendingLecture] = useState(null);
  const [lectureSummary, setLectureSummary] = useState(null);
  const [lectureTranscript, setLectureTranscript] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const pdfInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const recordingDurationRef = useRef(0);
  const recordingForFolderRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionTranscriptRef = useRef('');
  const [editingLectureTitleId, setEditingLectureTitleId] = useState(null);
  const [editingLectureTitleValue, setEditingLectureTitleValue] = useState('');
  const [viewingLectureTranscript, setViewingLectureTranscript] = useState('');
  const [publishingItemId, setPublishingItemId] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [createIsPublic, setCreateIsPublic] = useState(true);
  const [flashPracticeActive, setFlashPracticeActive] = useState(false);
  const [flashPracticeQueue, setFlashPracticeQueue] = useState([]);
  const [flashPracticeIndex, setFlashPracticeIndex] = useState(0);
  const [flashPracticeWrong, setFlashPracticeWrong] = useState([]);
  const [flashPracticeRound, setFlashPracticeRound] = useState(1);
  const [flashPracticeRightTotal, setFlashPracticeRightTotal] = useState(0);
  const [flashPracticeWrongTotal, setFlashPracticeWrongTotal] = useState(0);
  const [flashPracticePhase, setFlashPracticePhase] = useState('round'); // 'round' | 'summary' | 'done'

  const persist = useCallback((nextFolders, nextItems) => {
    saveStudyData(userId, { folders: nextFolders, itemsByFolder: nextItems });
  }, [userId]);

  useEffect(() => {
    const data = loadStudyData(userId);
    setFolders(data.folders);
    setItemsByFolder(data.itemsByFolder);
  }, [userId]);

  // Sync viewer from URL (/study/:folderId/:itemId)
  useEffect(() => {
    if (!initialViewingFolderId || !initialViewingItemId) return;
    const folder = folders.find((f) => f.id === initialViewingFolderId);
    const list = folder ? (itemsByFolder[initialViewingFolderId] || []) : [];
    const item = list.find((i) => i.id === initialViewingItemId);
    if (item) {
      onSelectFolderId(initialViewingFolderId);
      setViewingItem(item);
      setFlashPracticeActive(false);
      setFlashPracticeQueue([]);
      setFlashPracticeWrong([]);
    }
  }, [initialViewingFolderId, initialViewingItemId, folders, itemsByFolder, onSelectFolderId]);

  function resetFlashPractice() {
    setFlashPracticeActive(false);
    setFlashPracticeQueue([]);
    setFlashPracticeIndex(0);
    setFlashPracticeWrong([]);
    setFlashPracticeRound(1);
    setFlashPracticeRightTotal(0);
    setFlashPracticeWrongTotal(0);
    setFlashPracticePhase('round');
    setFlashcardFlipped(false);
  }

  function startFlashPractice(cardsLength) {
    if (!cardsLength) return;
    setFlashPracticeActive(true);
    setFlashPracticeQueue(Array.from({ length: cardsLength }, (_, i) => i));
    setFlashPracticeIndex(0);
    setFlashPracticeWrong([]);
    setFlashPracticeRound(1);
    setFlashPracticeRightTotal(0);
    setFlashPracticeWrongTotal(0);
    setFlashPracticePhase('round');
    setFlashcardFlipped(false);
  }

  function handleFlashPracticeAnswer(isRight) {
    if (!flashPracticeActive || flashPracticeQueue.length === 0) return;
    const currentIdxInQueue = flashPracticeIndex;
    const cardIndex = flashPracticeQueue[currentIdxInQueue];
    const isLast = currentIdxInQueue >= flashPracticeQueue.length - 1;

    if (isRight) {
      setFlashPracticeRightTotal((v) => v + 1);
    }
    let nextWrong = flashPracticeWrong;
    if (!isRight) {
      nextWrong = [...flashPracticeWrong, cardIndex];
    }

    if (!isLast) {
      setFlashPracticeWrong(nextWrong);
      setFlashPracticeIndex((i) => i + 1);
      setFlashcardFlipped(false);
    } else {
      setFlashPracticeWrong(nextWrong);
      setFlashcardFlipped(false);
      setFlashPracticePhase(nextWrong.length === 0 ? 'done' : 'summary');
      if (nextWrong.length > 0) {
        // prepare next round when user continues
        // round number increments when they move on from summary
      }
    }
    if (!isRight) {
      setFlashPracticeWrongTotal((v) => v + 1);
    }
  }

  // Sync viewer from URL (e.g. /study/folderId/itemId)
  useEffect(() => {
    if (!initialViewingFolderId || !initialViewingItemId) {
      setViewingItem(null);
      return;
    }
    const folder = folders.find((f) => f.id === initialViewingFolderId);
    const list = folder ? (itemsByFolder[initialViewingFolderId] || []) : [];
    const item = list.find((i) => i.id === initialViewingItemId);
    if (item) {
      onSelectFolderId(initialViewingFolderId);
      setViewingItem(item);
    } else {
      setViewingItem(null);
    }
  }, [initialViewingFolderId, initialViewingItemId, folders, itemsByFolder, onSelectFolderId]);


  function handleAddFolder() {
    const name = (addFolderName || '').trim();
    if (!name) return;
    const description = (addFolderDescription || '').trim() || undefined;
    const newFolder = { id: id(), name, description };
    const next = [...folders, newFolder];
    setFolders(next);
    setItemsByFolder((prev) => ({ ...prev, [newFolder.id]: [] }));
    persist(next, { ...itemsByFolder, [newFolder.id]: [] });
    setAddFolderName('');
    setAddFolderDescription('');
    setShowAddFolder(false);
  }

  async function generateFlashcards(text, count) {
    const messages = [
      {
        role: 'system',
        content: 'You generate JSON arrays of flashcards. Output only JSON: [{"front":"...","back":"..."}].',
      },
      {
        role: 'user',
        content: `Create ${count} flashcards from this text:\n\n${text}`,
      },
    ];
    const reply = await chatCompletion(messages);
    try {
      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
    return [];
  }

  async function generateStudyGuide(text, mode) {
    const messages = [
      {
        role: 'system',
        content: 'You generate JSON study guides: {"sections":[{"title":"...","content":"..."}]}. Output only JSON.',
      },
      {
        role: 'user',
        content: `${mode === 'long' ? 'Make a detailed study guide.' : 'Make a concise study guide.'}\n\nText:\n${text}`,
      },
    ];
    const reply = await chatCompletion(messages);
    try {
      const parsed = JSON.parse(reply);
      if (parsed && Array.isArray(parsed.sections)) return parsed;
    } catch {
      // ignore
    }
    return { sections: [] };
  }

  async function generatePracticeTest(text, count) {
    const messages = [
      {
        role: 'system',
        content: 'You generate JSON multiple-choice questions: [{"question":"...","choices":["A","B","C","D"],"answerIndex":0}]. Output only JSON.',
      },
      {
        role: 'user',
        content: `Create ${count} practice questions from this text:\n\n${text}`,
      },
    ];
    const reply = await chatCompletion(messages);
    try {
      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return [];
  }

  async function generateLectureSummary(text) {
    const messages = [
      {
        role: 'system',
        content: 'You summarize lecture transcripts into short, clear study notes.',
      },
      {
        role: 'user',
        content: `Summarize this lecture into concise study notes:\n\n${text}`,
      },
    ];
    const reply = await chatCompletion(messages);
    return reply.trim();
  }

  function handleDeleteFolder(folderId) {
    const next = folders.filter((f) => f.id !== folderId);
    const nextItems = { ...itemsByFolder };
    delete nextItems[folderId];
    setFolders(next);
    setItemsByFolder(nextItems);
    if (selectedFolderId === folderId) onSelectFolderId(null);
    persist(next, nextItems);
  }

  async function handleTogglePublicItem(folderId, itemId) {
    setPublishError(null);
    const list = itemsByFolder[folderId] || [];
    const item = list.find((i) => i.id === itemId);
    if (!item) return;
    try {
      setPublishingItemId(itemId);
      if (!item.isPublic) {
        const created = await publishStudyItem(item, folders.find((f) => f.id === folderId)?.name);
        const nextList = list.map((i) =>
          i.id === itemId ? { ...i, isPublic: true, publicId: created?.id || null } : i,
        );
        setItemsByFolder({ ...itemsByFolder, [folderId]: nextList });
        persist(folders, { ...itemsByFolder, [folderId]: nextList });
      } else {
        if (item.publicId) await setPublicItemVisibility(item.publicId, false);
        const nextList = list.map((i) => (i.id === itemId ? { ...i, isPublic: false } : i));
        setItemsByFolder({ ...itemsByFolder, [folderId]: nextList });
        persist(folders, { ...itemsByFolder, [folderId]: nextList });
      }
    } catch (err) {
      setPublishError(err?.message || 'Could not update public visibility.');
    } finally {
      setPublishingItemId(null);
    }
  }

  function handleDeleteItem(folderId, itemId) {
    const list = itemsByFolder[folderId] || [];
    const nextList = list.filter((i) => i.id !== itemId);
    const nextItems = { ...itemsByFolder, [folderId]: nextList };
    setItemsByFolder(nextItems);
    persist(folders, nextItems);
    if (viewingItem?.id === itemId) setViewingItem(null);
  }

  function handleRenameFolder(folderId, name, description) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return;
    const next = folders.map((f) => (f.id === folderId ? { ...f, name: trimmedName, description: (description || '').trim() || undefined } : f));
    setFolders(next);
    setEditingFolderId(null);
    persist(next, itemsByFolder);
  }

  function handleRenameItem(folderId, itemId, title) {
    const trimmedTitle = clampTitle(title);
    if (!trimmedTitle) return;
    const list = itemsByFolder[folderId] || [];
    const nextList = list.map((i) => (i.id === itemId ? { ...i, title: trimmedTitle } : i));
    const nextItems = { ...itemsByFolder, [folderId]: nextList };
    setItemsByFolder(nextItems);
    persist(folders, nextItems);
    setEditingItemId(null);
    if (viewingItem?.id === itemId) setViewingItem((prev) => (prev ? { ...prev, title: trimmedTitle } : null));
  }

  function updateLectureData(folderId, itemId, dataPatch) {
    const list = itemsByFolder[folderId] || [];
    const nextList = list.map((i) => (i.id === itemId ? { ...i, data: { ...(i.data || {}), ...dataPatch } } : i));
    const nextItems = { ...itemsByFolder, [folderId]: nextList };
    setItemsByFolder(nextItems);
    persist(folders, nextItems);
  }

  async function startRecording() {
    setGenError(null);
    recognitionTranscriptRef.current = '';
    recordingForFolderRef.current = lectureFlowFolderId || null;
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const res = event.results[i];
            if (res.isFinal) {
              text += res[0].transcript;
            }
          }
          if (text) {
            recognitionTranscriptRef.current = `${recognitionTranscriptRef.current} ${text}`.trim();
          }
        };
        recognition.onerror = () => {};
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
          recognitionTranscriptRef.current = '';
        }
      } else {
        recognitionRef.current = null;
        recognitionTranscriptRef.current = '';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
          recognitionRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const durationSec = recordingDurationRef.current;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
          const name = clampTitle(`Lecture ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
          const transcriptText = recognitionTranscriptRef.current.trim();
          const folderId = recordingForFolderRef.current;
          if (folderId) {
            const list = itemsByFolder[folderId] || [];
            const data = {
              audioBase64: base64,
              durationSec,
              createdAt: Date.now(),
              transcript: transcriptText,
              summary: null,
              notes: null,
            };
            const nextItems = {
              ...itemsByFolder,
              [folderId]: [...list, { id: id(), type: 'lecture_recording', title: name, data }],
            };
            setItemsByFolder(nextItems);
            persist(folders, nextItems);
            recordStudyItems(userId, 1);
          }
          recognitionTranscriptRef.current = '';
          setLectureFlowFolderId(null);
          setPendingLecture(null);
          setLectureTranscript('');
        };
        reader.readAsDataURL(blob);
        setRecordingSeconds(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      setGenError(err?.message || 'Microphone access is needed to record.');
    }
  }

  function stopRecording() {
    recordingDurationRef.current = recordingSeconds;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    mediaRecorderRef.current = null;
    // keep recordingForFolderRef so onstop can save into the correct folder
    setIsRecording(false);
  }

  function playRecordingAudio(rec, id) {
    const key = id ?? rec?.id ?? 'pending';
    if (playingId === key) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    setPlayingId(key);
    const base64 = rec?.audioBase64 ?? '';
    const dataUri = `data:audio/webm;base64,${base64}`;
    const audio = audioRef.current;
    if (audio) {
      audio.src = dataUri;
      audio.play().catch(() => setPlayingId(null));
    }
  }

  function cancelLectureFlow() {
    setLectureFlowFolderId(null);
    setPendingLecture(null);
    setLectureSummary(null);
    setLectureTranscript('');
    setGenError(null);
    if (playingId) setPlayingId(null);
  }

  function clampTitle(raw) {
    const t = (raw || '').trim();
    if (!t) return '';
    return t.length <= 50 ? t : t.slice(0, 50);
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function handleSaveGenerated(typeOrAll) {
    const typesToSave = typeOrAll === 'all'
      ? Object.keys(generatedByType).filter((t) => generatedByType[t] != null)
      : [typeOrAll];
    if (!selectedFolderId || typesToSave.length === 0) return;
    const newItems = [];
    for (const type of typesToSave) {
      const g = generatedByType[type];
      if (g == null) continue;
      const defaultTitle = type === 'flashcards' ? 'Flashcards' : type === 'study_guide' ? 'Study guide' : 'Practice test';
      const rawTitle = (saveTitlesByType[type] || saveTitle || '') || defaultTitle;
      const title = clampTitle(rawTitle);
      const data = type === 'flashcards' ? { cards: g } : type === 'study_guide' ? { sections: g.sections } : { questions: g };
      const newItem = { id: id(), type, title, data, isPublic: false, publicId: null };
      newItems.push(newItem);
    }
    if (newItems.length === 0) return;
    const { allowed } = canCreateStudyItems(userId, subscriptionTier, newItems.length);
    if (!allowed) {
      setGenError(`Free plan includes ${FREE_ITEM_LIMIT_PER_WEEK} study items per week. Upgrade to Pro for unlimited items.`);
      return;
    }
    const list = itemsByFolder[selectedFolderId] || [];
    const nextList = [...list, ...newItems];
    let nextItems = { ...itemsByFolder, [selectedFolderId]: nextList };
    setItemsByFolder(nextItems);
    persist(folders, nextItems);
    recordStudyItems(userId, newItems.length);
    if (createIsPublic && newItems.length > 0) {
      (async () => {
        try {
          const folder = folders.find((f) => f.id === selectedFolderId);
          let updated = nextItems[selectedFolderId] || [];
          for (const newItem of newItems) {
            const created = await publishStudyItem(newItem, folder?.name);
            updated = updated.map((i) => (i.id === newItem.id ? { ...i, isPublic: true, publicId: created?.id || null } : i));
          }
          nextItems = { ...nextItems, [selectedFolderId]: updated };
          setItemsByFolder(nextItems);
          persist(folders, nextItems);
        } catch (err) {
          setPublishError(err?.message || 'Could not publish one or more items.');
        }
      })();
    }
    if (typeOrAll === 'all' || typesToSave.length >= Object.keys(generatedByType).filter((t) => generatedByType[t] != null).length) {
      setCreateMode(null);
      setCreateModes([]);
      setPasteText('');
      setAttachedPdfs([]);
      setGenerated(null);
      setGeneratedByType({ flashcards: null, study_guide: null, practice_test: null });
      setSaveTitle('');
      setSaveTitlesByType({ flashcards: '', study_guide: '', practice_test: '' });
      setGenError(null);
    } else {
      const next = { ...generatedByType };
      typesToSave.forEach((t) => { next[t] = null; });
      setGeneratedByType(next);
    }
  }

  function handleSaveSingleGenerated() {
    if (!selectedFolderId || !generated) return;
    const type = createMode;
    const rawTitle = (saveTitle || '') || (type === 'flashcards' ? 'Flashcards' : type === 'study_guide' ? 'Study guide' : 'Practice test');
    const title = clampTitle(rawTitle);
    const data = type === 'flashcards' ? { cards: generated } : type === 'study_guide' ? { sections: generated.sections } : { questions: generated };
    const { allowed } = canCreateStudyItems(userId, subscriptionTier, 1);
    if (!allowed) {
      setGenError(`Free plan includes ${FREE_ITEM_LIMIT_PER_WEEK} study items per week. Upgrade to Pro for unlimited items.`);
      return;
    }
    const list = itemsByFolder[selectedFolderId] || [];
    const newItem = { id: id(), type, title, data, isPublic: false, publicId: null };
    let nextItems = { ...itemsByFolder, [selectedFolderId]: [...list, newItem] };
    setItemsByFolder(nextItems);
    persist(folders, nextItems);
    recordStudyItems(userId, 1);
    if (createIsPublic) {
      (async () => {
        try {
          const folder = folders.find((f) => f.id === selectedFolderId);
          const created = await publishStudyItem(newItem, folder?.name);
          const updated = (nextItems[selectedFolderId] || []).map((i) => (i.id === newItem.id ? { ...i, isPublic: true, publicId: created?.id || null } : i));
          nextItems = { ...nextItems, [selectedFolderId]: updated };
          setItemsByFolder(nextItems);
          persist(folders, nextItems);
        } catch (err) {
          setPublishError(err?.message || 'Could not publish this item.');
        }
      })();
    }
    setCreateMode(null);
    setCreateModes([]);
    setPasteText('');
    setAttachedPdfs([]);
    setGenerated(null);
    setGeneratedByType({ flashcards: null, study_guide: null, practice_test: null });
    setSaveTitle('');
    setGenError(null);
  }

  function getCombinedText() {
    const parts = [pasteText.trim(), ...attachedPdfs.map((p) => p.text?.trim()).filter(Boolean)];
    return parts.join('\n\n');
  }

  async function handleGenerate() {
    const combinedText = getCombinedText();
    if (!combinedText.trim()) return;
    const modes = createModes.length ? createModes : (createMode ? [createMode] : []);
    if (modes.length === 0) return;
    // Pre-check usage limits before generating anything
    const { allowed } = canCreateStudyItems(userId, subscriptionTier, modes.length);
    if (!allowed) {
      const msg = `Free plan includes ${FREE_ITEM_LIMIT_PER_WEEK} study items per week. Upgrade to Pro for unlimited items.`;
      setGenError(msg);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(msg);
      }
      return;
    }
    setIsGenerating(true);
    setGenError(null);
    setGeneratedByType({ flashcards: null, study_guide: null, practice_test: null });
    try {
      if (modes.length === 1) {
        const mode = modes[0];
        if (mode === 'flashcards') {
          const count = Math.min(50, Math.max(1, parseInt(flashcardCount, 10) || 10));
          const cards = await generateFlashcards(combinedText, count);
          setGenerated(cards);
        } else if (mode === 'study_guide') {
          const guide = await generateStudyGuide(combinedText, studyGuideMode);
          setGenerated(guide);
        } else if (mode === 'practice_test') {
          const count = Math.min(30, Math.max(1, parseInt(practiceTestCount, 10) || 10));
          const questions = await generatePracticeTest(combinedText, count);
          setGenerated(questions);
        }
      } else {
        const next = { flashcards: null, study_guide: null, practice_test: null };
        for (const mode of modes) {
          if (mode === 'flashcards') {
            const count = Math.min(50, Math.max(1, parseInt(flashcardCount, 10) || 10));
            next.flashcards = await generateFlashcards(combinedText, count);
          } else if (mode === 'study_guide') {
            next.study_guide = await generateStudyGuide(combinedText, studyGuideMode);
          } else if (mode === 'practice_test') {
            const count = Math.min(30, Math.max(1, parseInt(practiceTestCount, 10) || 10));
            next.practice_test = await generatePracticeTest(combinedText, count);
          }
        }
        setGeneratedByType(next);
      }
    } catch (err) {
      setGenError(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setGenError(null);
    setPdfExtracting(true);
    try {
      const text = await extractTextFromPdf(file);
      setAttachedPdfs((prev) => [...prev, { id: id(), name: file.name, text }]);
    } catch (err) {
      setGenError(err?.message || 'Could not extract text from PDF. Try a different file or paste text instead.');
    } finally {
      setPdfExtracting(false);
    }
  }

  function removeAttachedPdf(pdfId) {
    setAttachedPdfs((prev) => prev.filter((p) => p.id !== pdfId));
  }

  function cancelCreate() {
    setCreateMode(null);
    setCreateModes([]);
    setPasteText('');
    setAttachedPdfs([]);
    setGenerated(null);
    setGeneratedByType({ flashcards: null, study_guide: null, practice_test: null });
    setSaveTitle('');
    setSaveTitlesByType({ flashcards: '', study_guide: '', practice_test: '' });
    setGenError(null);
    setFlashcardCount(10);
    setPracticeTestCount(10);
    setStudyGuideMode('quick');
  }

  function toggleCreateMode(mode) {
    setCreateModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  }

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const folderItems = selectedFolderId ? (itemsByFolder[selectedFolderId] || []) : [];

  useEffect(() => {
    if (!viewingItem) return;
    const folder = folders.find((f) => (itemsByFolder[f.id] || []).some((i) => i.id === viewingItem.id));
    const item = folder && (itemsByFolder[folder.id] || []).find((i) => i.id === viewingItem.id);
    if (item?.type === 'lecture_recording') {
      const data = item.data || {};
      setViewingLectureTranscript(data.transcript || '');
      setEditingLectureTitleId(null);
      setEditingLectureTitleValue('');
    }
  }, [viewingItem, folders, itemsByFolder]);

  // Full-screen viewer for one item
  if (viewingItem) {
    const folder = folders.find((f) => (itemsByFolder[f.id] || []).some((i) => i.id === viewingItem.id));
    const item = folder && (itemsByFolder[folder.id] || []).find((i) => i.id === viewingItem.id);
    if (!item) {
      setViewingItem(null);
      return null;
    }
    if (item.type === 'flashcards') {
      const cards = item.data?.cards || [];
      const idx = Math.min(flashcardIndex, Math.max(0, cards.length - 1));
      const card = cards[idx];
      const practiceIdxInQueue = flashPracticeQueue[flashPracticeIndex] ?? 0;
      const practiceCard = cards[practiceIdxInQueue] || null;
      const totalCards = cards.length;

      if (flashPracticeActive && totalCards > 0) {
        if (flashPracticePhase === 'summary') {
          const totalThisRound = flashPracticeQueue.length;
          const wrongThisRound = flashPracticeWrong.length;
          const rightThisRound = Math.max(0, totalThisRound - wrongThisRound);
          const pct = totalThisRound > 0 ? Math.round((rightThisRound / totalThisRound) * 100) : 0;
          return (
            <div className="study-viewer">
              <div className="study-viewer-header">
                <button
                  type="button"
                  className="study-viewer-back"
                  onClick={() => {
                    resetFlashPractice();
                    onBackFromItem();
                    setViewingItem(null);
                  }}
                >
                  ← Back
                </button>
                <span className="study-viewer-title">{item.title} — Practice</span>
              </div>
              <div className="study-practice-summary">
                <h3>Round {flashPracticeRound} summary</h3>
                <p>
                  Right: {rightThisRound} &nbsp; Wrong: {wrongThisRound} &nbsp; (
                  {pct}
                  % correct)
                </p>
                <button
                  type="button"
                  className="study-btn study-btn-primary"
                  onClick={() => {
                    setFlashPracticeQueue(flashPracticeWrong);
                    setFlashPracticeWrong([]);
                    setFlashPracticeIndex(0);
                    setFlashPracticeRound((r) => r + 1);
                    setFlashPracticePhase('round');
                    setFlashcardFlipped(false);
                  }}
                >
                  Practice wrong cards
                </button>
              </div>
            </div>
          );
        }

        if (flashPracticePhase === 'done') {
          const totalAnswered = flashPracticeRightTotal + flashPracticeWrongTotal;
          const pctTotal =
            totalAnswered > 0 ? Math.round((flashPracticeRightTotal / totalAnswered) * 100) : 100;
          return (
            <div className="study-viewer">
              <div className="study-viewer-header">
                <button
                  type="button"
                  className="study-viewer-back"
                  onClick={() => {
                    resetFlashPractice();
                    onBackFromItem();
                    setViewingItem(null);
                  }}
                >
                  ← Back
                </button>
                <span className="study-viewer-title">{item.title} — Practice complete</span>
              </div>
              <div className="study-practice-summary">
                <h3>Nice work!</h3>
                <p>
                  Total right: {flashPracticeRightTotal} &nbsp; Total wrong: {flashPracticeWrongTotal}
                  {totalAnswered > 0 && (
                    <>
                      &nbsp; ({pctTotal}
                      % correct)
                    </>
                  )}
                </p>
                <div className="study-practice-actions">
                  <button
                    type="button"
                    className="study-btn study-btn-primary"
                    onClick={() => startFlashPractice(totalCards)}
                  >
                    Restart practice
                  </button>
                  <button
                    type="button"
                    className="study-btn study-btn-secondary"
                    onClick={() => {
                      resetFlashPractice();
                      onBackFromItem();
                      setViewingItem(null);
                    }}
                  >
                    Exit
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Active round
        const practiceCardToShow = practiceCard;
        return (
          <div className="study-viewer">
            <div className="study-viewer-header">
              <button
                type="button"
                className="study-viewer-back"
                onClick={() => {
                  resetFlashPractice();
                  onBackFromItem();
                  setViewingItem(null);
                }}
              >
                ← Back
              </button>
              <span className="study-viewer-title">{item.title} — Practice</span>
              <span className="study-viewer-nav">
                Round {flashPracticeRound} · Card {flashPracticeIndex + 1} / {flashPracticeQueue.length}
              </span>
            </div>
            <div className="study-flashcard-wrap">
              {practiceCardToShow ? (
                <>
                  <button
                    type="button"
                    className="study-flashcard"
                    onClick={() => setFlashcardFlipped((f) => !f)}
                  >
                    <p className="study-flashcard-label">
                      {flashcardFlipped ? 'Back' : 'Front'}
                    </p>
                    <p className="study-flashcard-text">
                      {flashcardFlipped ? practiceCardToShow.back : practiceCardToShow.front}
                    </p>
                  </button>
                  <div className="study-practice-buttons">
                    <button
                      type="button"
                      className="study-btn study-btn-secondary"
                      onClick={() => handleFlashPracticeAnswer(false)}
                    >
                      Wrong
                    </button>
                    <button
                      type="button"
                      className="study-btn study-btn-primary"
                      onClick={() => handleFlashPracticeAnswer(true)}
                    >
                      Right
                    </button>
                  </div>
                </>
              ) : (
                <p>No cards in this set.</p>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="study-viewer">
          <div className="study-viewer-header">
            <button type="button" className="study-viewer-back" onClick={() => { onBackFromItem(); setViewingItem(null); setFlashcardIndex(0); setFlashcardFlipped(false); }}>
              ← Back
            </button>
            <span className="study-viewer-title">{item.title}</span>
            <span className="study-viewer-nav">{idx + 1} / {cards.length}</span>
            <button type="button" className="study-viewer-delete" onClick={() => { handleDeleteItem(folder.id, item.id); onBackFromItem(); setViewingItem(null); setFlashcardIndex(0); setFlashcardFlipped(false); }} aria-label="Delete">Delete</button>
          </div>
          <div className="study-viewer-public-row">
            <button type="button" className="study-public-toggle-btn" onClick={() => handleTogglePublicItem(folder.id, item.id)} disabled={publishingItemId === item.id}>
              {publishingItemId === item.id ? 'Updating…' : item.isPublic ? 'Make private' : 'Make public'}
            </button>
            <span className="study-public-label">{item.isPublic ? 'Public in library' : 'Private'}</span>
          </div>
          <div className="study-flashcard-wrap">
            {card ? (
              <>
                <button
                  type="button"
                  className="study-flashcard"
                  onClick={() => setFlashcardFlipped((f) => !f)}
                >
                  <p className="study-flashcard-label">{flashcardFlipped ? 'Back' : 'Front'}</p>
                  <p className="study-flashcard-text">{flashcardFlipped ? card.back : card.front}</p>
                </button>
                <div className="study-flashcard-arrows">
                  <button type="button" disabled={idx <= 0} onClick={() => { setFlashcardIndex(idx - 1); setFlashcardFlipped(false); }}>Prev</button>
                  <button type="button" disabled={idx >= cards.length - 1} onClick={() => { setFlashcardIndex(idx + 1); setFlashcardFlipped(false); }}>Next</button>
                </div>
                <div className="study-practice-start">
                  <button
                    type="button"
                    className="study-btn study-btn-primary"
                    onClick={() => startFlashPractice(cards.length)}
                  >
                    Practice
                  </button>
                </div>
              </>
            ) : (
              <p>No cards in this set.</p>
            )}
          </div>
        </div>
      );
    }
    // Practice test viewer
    if (item.type === 'practice_test') {
      const questions = item.data?.questions || [];
      const total = questions.length;
      const idx = Math.min(testQuestionIndex, total);
      const q = idx < total ? questions[idx] : null;
      const showScore = total === 0 || (testScore.total > 0 && idx >= total);
    const options = q ? (q.choices || q.options || []) : [];
    const correctIndex = q && typeof q.answerIndex === 'number' ? q.answerIndex : q?.correctIndex;
      return (
        <div className="study-viewer">
          <div className="study-viewer-header">
            <button type="button" className="study-viewer-back" onClick={() => { onBackFromItem(); setViewingItem(null); setTestQuestionIndex(0); setTestSelected(null); setTestShowResult(false); setTestScore({ correct: 0, total: 0 }); }}>← Back</button>
            <span className="study-viewer-title">{item.title}</span>
            {!showScore && total > 0 && <span className="study-viewer-nav">{Math.min(idx + 1, total)} / {total}</span>}
            <button type="button" className="study-viewer-delete" onClick={() => { handleDeleteItem(folder.id, item.id); onBackFromItem(); setViewingItem(null); setTestQuestionIndex(0); setTestSelected(null); setTestShowResult(false); setTestScore({ correct: 0, total: 0 }); }} aria-label="Delete">Delete</button>
          </div>
          <div className="study-viewer-public-row">
            <button type="button" className="study-public-toggle-btn" onClick={() => handleTogglePublicItem(folder.id, item.id)} disabled={publishingItemId === item.id}>
              {publishingItemId === item.id ? 'Updating…' : item.isPublic ? 'Make private' : 'Make public'}
            </button>
            <span className="study-public-label">{item.isPublic ? 'Public in library' : 'Private'}</span>
          </div>
          <div className="study-practice-test">
            {showScore ? (
              <div className="study-test-score">
              <h3>Results</h3>
              {total > 0 ? (
                <>
                  <p className="study-test-score-text">
                    You got {testScore.correct} out of {testScore.total} correct.
                  </p>
                  <p className="study-test-score-text">
                    Score:{' '}
                    {testScore.total > 0
                      ? Math.round((testScore.correct / testScore.total) * 100)
                      : 0}
                    %
                  </p>
                  <div className="study-practice-actions">
                    <button
                      type="button"
                      className="study-btn study-btn-primary"
                      onClick={() => {
                        setTestQuestionIndex(0);
                        setTestSelected(null);
                        setTestShowResult(false);
                        setTestScore({ correct: 0, total: 0 });
                      }}
                    >
                      Restart test
                    </button>
                    <button
                      type="button"
                      className="study-btn study-btn-secondary"
                      onClick={() => {
                        onBackFromItem();
                        setViewingItem(null);
                        setTestQuestionIndex(0);
                        setTestSelected(null);
                        setTestShowResult(false);
                        setTestScore({ correct: 0, total: 0 });
                      }}
                    >
                      Exit
                    </button>
                  </div>
                </>
              ) : (
                <p className="study-test-score-text">No questions in this test.</p>
              )}
              </div>
            ) : q ? (
              <>
                <p className="study-test-question">{q.question}</p>
                <div className="study-test-options">
                {options.map((opt, i) => {
                    const selected = testSelected === i;
                  const correct = typeof correctIndex === 'number' && correctIndex === i;
                    const showRight = testShowResult && correct;
                    const showWrong = testShowResult && selected && !correct;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`study-test-option ${showRight ? 'study-test-option--correct' : ''} ${showWrong ? 'study-test-option--wrong' : ''}`}
                        onClick={() => {
                          if (testShowResult) return;
                          setTestSelected(i);
                          setTestShowResult(true);
                        setTestScore((s) => ({
                          correct: s.correct + (typeof correctIndex === 'number' && i === correctIndex ? 1 : 0),
                          total: s.total + 1,
                        }));
                        }}
                        disabled={testShowResult}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {testShowResult && (
                  <button type="button" className="study-btn study-btn-primary study-test-next" onClick={() => { setTestQuestionIndex(idx + 1); setTestSelected(null); setTestShowResult(false); }}>{idx + 1 >= total ? 'See results' : 'Next question'}</button>
                )}
              </>
            ) : (
              <p>No questions in this test.</p>
            )}
          </div>
        </div>
      );
    }
    // Lecture recording viewer
    if (item.type === 'lecture_recording') {
      const data = item.data || {};
      const summary = data.summary ?? '';
      const notes = Array.isArray(data.notes) ? data.notes : [];
      const hasSummary = !!summary || notes.length > 0;
      const transcriptForView = hasSummary ? (data.transcript ?? '') : viewingLectureTranscript;
      return (
        <div className="study-viewer">
          <div className="study-viewer-header">
            <button type="button" className="study-viewer-back" onClick={() => { onBackFromItem(); setViewingItem(null); }}>← Back</button>
            {editingLectureTitleId === item.id ? (
              <>
                <input
                  type="text"
                  className="study-folder-input"
                  value={editingLectureTitleValue}
                  onChange={(e) => setEditingLectureTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameItem(folder.id, item.id, editingLectureTitleValue);
                      setEditingLectureTitleId(null);
                    }
                    if (e.key === 'Escape') {
                      setEditingLectureTitleId(null);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="study-btn study-btn-secondary"
                  onClick={() => setEditingLectureTitleId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="study-btn study-btn-primary"
                  onClick={() => {
                    handleRenameItem(folder.id, item.id, editingLectureTitleValue);
                    setEditingLectureTitleId(null);
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span className="study-viewer-title">{item.title}</span>
                <button
                  type="button"
                  className="study-folder-edit-btn"
                  onClick={() => {
                    setEditingLectureTitleId(item.id);
                    setEditingLectureTitleValue(item.title);
                  }}
                >
                  Edit name
                </button>
              </>
            )}
            <button type="button" className="study-viewer-delete" onClick={() => { handleDeleteItem(folder.id, item.id); onBackFromItem(); setViewingItem(null); }} aria-label="Delete">Delete</button>
          </div>
          <div className="study-lecture-view">
            {data.audioBase64 && (
              <div className="study-lecture-audio-row">
                <button type="button" className="study-btn study-btn-primary" onClick={() => playRecordingAudio(data, item.id)}>
                  {playingId === item.id ? 'Pause' : 'Play'} recording
                </button>
              </div>
            )}
            {hasSummary ? (
              <>
                {summary && (
                  <div className="study-lecture-summary-box">
                    <h3 className="study-lecture-summary-heading">Summary</h3>
                    <p className="study-lecture-summary-text">{summary}</p>
                  </div>
                )}
                {notes.length > 0 && (
                  <>
                    <h3 className="study-lecture-summary-heading">Notes</h3>
                    <ul className="study-lecture-notes-list">
                      {notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </>
                )}
                {data.transcript && (
                  <div className="study-lecture-transcript-row">
                    <h3 className="study-lecture-summary-heading">Transcript</h3>
                    <p className="study-lecture-transcript-text">{data.transcript}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="study-main-hint">Review or edit the transcript below, then generate summary and notes.</p>
                <div className="study-lecture-transcript-row">
                  <textarea
                    className="study-create-textarea"
                    placeholder="Transcript from the recording…"
                    value={transcriptForView}
                    onChange={(e) => setViewingLectureTranscript(e.target.value)}
                    rows={6}
                  />
                  <div className="study-recordings-actions">
                    <button
                      type="button"
                      className="study-btn study-btn-primary"
                      onClick={async () => {
                        const text = (viewingLectureTranscript || '').trim();
                        if (!text) return;
                        setIsGeneratingSummary(true);
                        setGenError(null);
                        try {
                          const result = await generateLectureSummary(text);
                          updateLectureData(folder.id, item.id, {
                            transcript: text,
                            summary: result.summary,
                            notes: result.notes,
                          });
                          setViewingLectureTranscript(text);
                        } catch (err) {
                          setGenError(err?.message || 'Could not generate summary.');
                        } finally {
                          setIsGeneratingSummary(false);
                        }
                      }}
                      disabled={isGeneratingSummary || !(viewingLectureTranscript || '').trim()}
                    >
                      {isGeneratingSummary ? 'Generating…' : 'Generate summary & notes'}
                    </button>
                  </div>
                </div>
                {genError && <p className="study-create-error">{genError}</p>}
              </>
            )}
          </div>
          <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
        </div>
      );
    }
    // Study guide viewer
    const sections = item.data?.sections || [];
    return (
      <div className="study-viewer">
        <div className="study-viewer-header">
<button type="button" className="study-viewer-back" onClick={() => { onBackFromItem(); setViewingItem(null); }}>← Back</button>
        <span className="study-viewer-title">{item.title}</span>
        <button type="button" className="study-viewer-delete" onClick={() => { handleDeleteItem(folder.id, item.id); onBackFromItem(); setViewingItem(null); }} aria-label="Delete">Delete</button>
        </div>
        <div className="study-viewer-public-row">
          <button type="button" className="study-public-toggle-btn" onClick={() => handleTogglePublicItem(folder.id, item.id)} disabled={publishingItemId === item.id}>
            {publishingItemId === item.id ? 'Updating…' : item.isPublic ? 'Make private' : 'Make public'}
          </button>
          <span className="study-public-label">{item.isPublic ? 'Public in library' : 'Private'}</span>
        </div>
        <div className="study-guide-view">
          {sections.map((s, i) => (
            <section key={i} className="study-guide-section">
              <h3 className="study-guide-section-title">{s.title}</h3>
              <div className="study-guide-section-content">{s.content}</div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Create flow: paste text + generate + save
  const inCreateFlow = createMode || createModes.length > 0;
  const effectiveModes = createModes.length ? createModes : (createMode ? [createMode] : []);
  const hasMultiGenerated = generatedByType.flashcards != null || generatedByType.study_guide != null || generatedByType.practice_test != null;
  const hasSingleGenerated = generated != null;

  if (inCreateFlow) {
    const isFlashcards = effectiveModes.includes('flashcards') || createMode === 'flashcards';
    return (
      <div className="study-page">
        <div className="study-breadcrumb">
          <button type="button" className="study-back" onClick={() => { onSelectFolderId(null); cancelCreate(); }}>← Classes</button>
          {selectedFolder && <span className="study-breadcrumb-name">{selectedFolder.name}</span>}
        </div>
        <div className="study-create-box">
          <h2 className="study-create-title">Add from paste</h2>
          {!hasSingleGenerated && !hasMultiGenerated ? (
            <>
              <p className="study-create-hint">Paste your notes below and choose what to generate. You can select multiple. One paste can create flashcards, study guide, and practice test.</p>
              <div className="study-create-multi">
                <label className="study-create-check">
                  <input type="checkbox" checked={effectiveModes.includes('flashcards') || createMode === 'flashcards'} onChange={() => toggleCreateMode('flashcards')} />
                  <span>Flashcards</span>
                </label>
                {(effectiveModes.includes('flashcards') || createMode === 'flashcards') && (
                  <div className="study-create-option study-create-option-inline">
                    <label className="study-create-label">How many?</label>
                    <input type="number" min={1} max={50} className="study-create-number" value={flashcardCount} onChange={(e) => setFlashcardCount(e.target.value)} />
                  </div>
                )}
                <label className="study-create-check">
                  <input type="checkbox" checked={effectiveModes.includes('study_guide') || createMode === 'study_guide'} onChange={() => toggleCreateMode('study_guide')} />
                  <span>Study guide</span>
                </label>
                {(effectiveModes.includes('study_guide') || createMode === 'study_guide') && (
                  <div className="study-create-option study-create-option-inline">
                    <span className="study-create-label">Length</span>
                    <label className="study-create-radio-inline"><input type="radio" name="guideMode" value="quick" checked={studyGuideMode === 'quick'} onChange={() => setStudyGuideMode('quick')} /> Quick</label>
                    <label className="study-create-radio-inline"><input type="radio" name="guideMode" value="long" checked={studyGuideMode === 'long'} onChange={() => setStudyGuideMode('long')} /> Long</label>
                  </div>
                )}
                <label className="study-create-check">
                  <input type="checkbox" checked={effectiveModes.includes('practice_test') || createMode === 'practice_test'} onChange={() => toggleCreateMode('practice_test')} />
                  <span>Practice test (multiple choice)</span>
                </label>
                {(effectiveModes.includes('practice_test') || createMode === 'practice_test') && (
                  <div className="study-create-option study-create-option-inline">
                    <label className="study-create-label">Questions</label>
                    <input type="number" min={1} max={30} className="study-create-number" value={practiceTestCount} onChange={(e) => setPracticeTestCount(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="study-create-input-row">
                <textarea
                  className="study-create-textarea"
                  placeholder="Paste your notes or textbook excerpt here. You can also attach PDFs below."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={8}
                />
                <div className="study-create-pdf-row">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="study-create-pdf-input"
                    onChange={handlePdfUpload}
                    aria-label="Upload PDF"
                  />
                  <button
                    type="button"
                    className="study-btn study-btn-secondary"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={pdfExtracting}
                  >
                    {pdfExtracting ? 'Extracting…' : 'Upload PDF'}
                  </button>
                </div>
                {attachedPdfs.length > 0 && (
                  <ul className="study-create-pdf-list" aria-label="Attached PDFs">
                    {attachedPdfs.map((pdf) => (
                      <li key={pdf.id} className="study-create-pdf-item">
                        <span className="study-create-pdf-name">{pdf.name}</span>
                        <button
                          type="button"
                          className="study-create-pdf-remove"
                          onClick={() => removeAttachedPdf(pdf.id)}
                          aria-label={`Remove ${pdf.name}`}
                          title="Remove file"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {genError && <p className="study-create-error">{genError}</p>}
              <div className="study-create-public-toggle">
                <label className="study-create-check">
                  <input type="checkbox" checked={createIsPublic} onChange={(e) => setCreateIsPublic(e.target.checked)} />
                  <span>Make created set(s) public in the shared library</span>
                </label>
              </div>
              <div className="study-create-actions">
                <button type="button" className="study-btn study-btn-secondary" onClick={cancelCreate}>Cancel</button>
                <button type="button" className="study-btn study-btn-primary" onClick={handleGenerate} disabled={!getCombinedText().trim() || isGenerating || effectiveModes.length === 0}>
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </>
          ) : hasMultiGenerated ? (
            <>
              <p className="study-create-hint">Save what you generated to this folder.</p>
              {generatedByType.flashcards != null && (
                <div className="study-generated-preview">
                  <p>Flashcards: {generatedByType.flashcards.length} cards</p>
                  <input type="text" className="study-save-title" placeholder="Title (optional)" value={saveTitlesByType.flashcards} onChange={(e) => setSaveTitlesByType((t) => ({ ...t, flashcards: e.target.value }))} />
                  <button type="button" className="study-btn study-btn-primary" onClick={() => handleSaveGenerated('flashcards')}>Save flashcards</button>
                </div>
              )}
              {generatedByType.study_guide != null && (
                <div className="study-generated-preview">
                  <p>Study guide: {generatedByType.study_guide.sections?.length || 0} sections</p>
                  <input type="text" className="study-save-title" placeholder="Title (optional)" value={saveTitlesByType.study_guide} onChange={(e) => setSaveTitlesByType((t) => ({ ...t, study_guide: e.target.value }))} />
                  <button type="button" className="study-btn study-btn-primary" onClick={() => handleSaveGenerated('study_guide')}>Save study guide</button>
                </div>
              )}
              {generatedByType.practice_test != null && (
                <div className="study-generated-preview">
                  <p>Practice test: {generatedByType.practice_test.length} questions</p>
                  <input type="text" className="study-save-title" placeholder="Title (optional)" value={saveTitlesByType.practice_test} onChange={(e) => setSaveTitlesByType((t) => ({ ...t, practice_test: e.target.value }))} />
                  <button type="button" className="study-btn study-btn-primary" onClick={() => handleSaveGenerated('practice_test')}>Save practice test</button>
                </div>
              )}
              <div className="study-create-actions">
                <button type="button" className="study-btn study-btn-secondary" onClick={() => { setGeneratedByType({ flashcards: null, study_guide: null, practice_test: null }); setGenError(null); }}>Regenerate</button>
                <button type="button" className="study-btn study-btn-primary" onClick={() => handleSaveGenerated('all')}>Save all</button>
              </div>
            </>
          ) : (
            <>
              <p className="study-create-hint">Review and save to this folder.</p>
              {createMode === 'flashcards' && (
                <div className="study-generated-preview">
                  <p>{generated.length} cards generated.</p>
                  <input type="text" className="study-save-title" placeholder="Set title (optional)" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
                </div>
              )}
              {createMode === 'study_guide' && (
                <div className="study-generated-preview">
                  <p>{generated.sections?.length || 0} sections.</p>
                  <input type="text" className="study-save-title" placeholder="Study guide title (optional)" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
                </div>
              )}
              {createMode === 'practice_test' && (
                <div className="study-generated-preview">
                  <p>{generated.length} questions generated.</p>
                  <input type="text" className="study-save-title" placeholder="Test title (optional)" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
                </div>
              )}
              <div className="study-create-actions">
                <button type="button" className="study-btn study-btn-secondary" onClick={() => { setGenerated(null); setGenError(null); }}>Regenerate</button>
                <button type="button" className="study-btn study-btn-primary" onClick={handleSaveSingleGenerated}>Save to folder</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Folder content view
  if (selectedFolderId && selectedFolder) {
    const isEditingFolder = editingFolderId === selectedFolderId;
    const inLectureFlow = lectureFlowFolderId === selectedFolderId;

    if (inLectureFlow) {
      return (
        <div className="study-page">
          <div className="study-breadcrumb">
            <button type="button" className="study-back" onClick={() => { cancelLectureFlow(); if (isRecording) stopRecording(); }}>← {selectedFolder.name}</button>
            <span className="study-breadcrumb-name">Lecture recording</span>
          </div>
          <h2 className="study-main-title">Lecture recording</h2>
          <p className="study-main-hint">Record your lecture. When you stop, the recording will be saved into this folder. You can then click it to edit the name and generate notes.</p>
          <div className="study-recordings-actions">
            {!isRecording ? (
              <button type="button" className="study-btn study-btn-primary" onClick={() => { setGenError(null); startRecording(); }}>Start recording</button>
            ) : (
              <div className="study-recording-active">
                <span className="study-recording-timer">{formatDuration(recordingSeconds)}</span>
                <button type="button" className="study-btn study-btn-secondary" onClick={stopRecording}>Stop</button>
              </div>
            )}
          </div>
          <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
        </div>
      );
    }

    return (
      <div className="study-page">
        <div className="study-breadcrumb">
          <button type="button" className="study-back" onClick={() => { onSelectFolderId(null); setEditingFolderId(null); }}>← Classes</button>
          <span className="study-breadcrumb-name">{selectedFolder.name}</span>
        </div>
        {isEditingFolder ? (
          <div className="study-folder-edit-inline">
            <input
              type="text"
              className="study-folder-input"
              placeholder="Folder name"
              value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(selectedFolderId, editFolderName, editFolderDescription)}
            />
            <textarea
              className="study-folder-input study-folder-desc-input"
              placeholder="Description (optional)"
              value={editFolderDescription}
              onChange={(e) => setEditFolderDescription(e.target.value)}
              rows={2}
            />
            <div className="study-folder-edit-actions">
              <button type="button" className="study-btn study-btn-secondary" onClick={() => { setEditingFolderId(null); }}>Cancel</button>
              <button type="button" className="study-btn study-btn-primary" onClick={() => handleRenameFolder(selectedFolderId, editFolderName, editFolderDescription)}>Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className="study-folder-title-row">
              <h2 className="study-folder-title">{selectedFolder.name}</h2>
              <button type="button" className="study-folder-edit-btn" onClick={() => { setEditingFolderId(selectedFolderId); setEditFolderName(selectedFolder.name); setEditFolderDescription(selectedFolder.description || ''); }} aria-label="Edit folder">Edit</button>
            </div>
            {selectedFolder.description && <p className="study-folder-description">{selectedFolder.description}</p>}
          </>
        )}
        <p className="study-folder-hint">Add flashcards, study guides, practice tests, or lecture recordings. Publish items to the public library from each item or when creating.</p>
        {publishError && <p className="study-create-error" role="alert">{publishError}</p>}
        <div className="study-add-buttons">
          <button type="button" className="study-btn study-btn-primary" onClick={() => { setCreateMode('flashcards'); setCreateModes(['flashcards']); }}>
            Add flashcards
          </button>
          <button type="button" className="study-btn study-btn-primary" onClick={() => { setCreateMode('study_guide'); setCreateModes(['study_guide']); }}>
            Add study guide
          </button>
          <button type="button" className="study-btn study-btn-primary" onClick={() => { setCreateMode('practice_test'); setCreateModes(['practice_test']); }}>
            Add practice test
          </button>
          <button
            type="button"
            className="study-btn study-btn-secondary"
            onClick={() => {
              const { allowed } = canCreateStudyItems(userId, subscriptionTier, 1);
              if (!allowed) {
                const msg = `Free plan includes ${FREE_ITEM_LIMIT_PER_WEEK} study items per week. Upgrade to Pro for unlimited items.`;
                setGenError(msg);
                if (typeof window !== 'undefined' && window.alert) {
                  window.alert(msg);
                }
                return;
              }
              setLectureFlowFolderId(selectedFolderId);
              setGenError(null);
            }}
          >
            Add lecture recording
          </button>
        </div>
        <ul className="study-item-list">
          {folderItems.map((item) => (
            <li key={item.id} className="study-item-wrap">
              {editingItemId === item.id ? (
                <div className="study-item-edit-inline">
                  <input
                    type="text"
                    className="study-item-edit-input"
                    value={editItemTitle}
                    onChange={(e) => setEditItemTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameItem(selectedFolderId, item.id, editItemTitle); if (e.key === 'Escape') setEditingItemId(null); }}
                    autoFocus
                  />
                  <button type="button" className="study-btn study-btn-secondary study-item-edit-btn" onClick={() => setEditingItemId(null)}>Cancel</button>
                  <button type="button" className="study-btn study-btn-primary study-item-edit-btn" onClick={() => handleRenameItem(selectedFolderId, item.id, editItemTitle)}>Save</button>
                </div>
              ) : (
                <>
                  <button type="button" className="study-item-card" onClick={() => { setViewingItem(item); onOpenItem(selectedFolderId, item.id); }}>
                    <span className="study-item-type">{item.type === 'flashcards' ? 'Flashcards' : item.type === 'practice_test' ? 'Practice test' : item.type === 'lecture_recording' ? 'Lecture recording' : 'Study guide'}</span>
                    <span className="study-item-title">{item.title}</span>
                  </button>
                  <button type="button" className="study-item-edit" onClick={(e) => { e.stopPropagation(); setEditingItemId(item.id); setEditItemTitle(item.title); }} aria-label={`Edit ${item.title}`}>Edit</button>
                  <button
                    type="button"
                    className="study-item-edit"
                    onClick={(e) => { e.stopPropagation(); handleTogglePublicItem(selectedFolderId, item.id); }}
                    disabled={publishingItemId === item.id}
                    aria-label={item.isPublic ? 'Make private' : 'Make public'}
                  >
                    {publishingItemId === item.id ? 'Updating…' : item.isPublic ? 'Make private' : 'Make public'}
                  </button>
                  <button type="button" className="study-item-delete" onClick={(e) => { e.stopPropagation(); handleDeleteItem(selectedFolderId, item.id); }} aria-label={`Delete ${item.title}`}>×</button>
                </>
              )}
            </li>
          ))}
        </ul>
        {folderItems.length === 0 && (
          <p className="study-empty-items">No items yet. Add flashcards, study guides, practice tests, or lecture recordings above.</p>
        )}
      </div>
    );
  }

  // Folder list
  return (
    <div className="study-page">
      <h2 className="study-main-title">Your class folders</h2>
      <p className="study-main-hint">Create folders for each class, then add flashcards and study guides from your notes using AI.</p>
      <div className="study-main-actions">
        <button type="button" className="study-btn study-btn-primary study-add-folder-btn" onClick={() => setShowAddFolder(true)}>
          + Add folder
        </button>
      </div>
      {showAddFolder && (
        <div className="study-add-folder">
          <input
            type="text"
            className="study-folder-input"
            placeholder="Class or folder name"
            value={addFolderName}
            onChange={(e) => setAddFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            autoFocus
          />
          <textarea
            className="study-folder-input study-folder-desc-input"
            placeholder="Description (optional)"
            value={addFolderDescription}
            onChange={(e) => setAddFolderDescription(e.target.value)}
            rows={2}
          />
          <div className="study-add-folder-actions">
            <button type="button" className="study-btn study-btn-secondary" onClick={() => { setShowAddFolder(false); setAddFolderName(''); setAddFolderDescription(''); }}>Cancel</button>
            <button type="button" className="study-btn study-btn-primary" onClick={handleAddFolder}>Add folder</button>
          </div>
        </div>
      )}
      <ul className="study-folder-list">
        {folders.map((folder) => (
          <li key={folder.id} className="study-folder-card-wrap">
            {editingFolderId === folder.id ? (
              <div className="study-folder-edit-inline study-folder-edit-inline--card">
                <input
                  type="text"
                  className="study-folder-input"
                  placeholder="Folder name"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(folder.id, editFolderName, editFolderDescription)}
                />
                <textarea
                  className="study-folder-input study-folder-desc-input"
                  placeholder="Description (optional)"
                  value={editFolderDescription}
                  onChange={(e) => setEditFolderDescription(e.target.value)}
                  rows={2}
                />
                <div className="study-folder-edit-actions">
                  <button type="button" className="study-btn study-btn-secondary" onClick={() => setEditingFolderId(null)}>Cancel</button>
                  <button type="button" className="study-btn study-btn-primary" onClick={() => handleRenameFolder(folder.id, editFolderName, editFolderDescription)}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="study-folder-card" onClick={() => { onSelectFolderId(folder.id); onAddRecent('folder', folder.id, folder.name); }}>
                  <div className="study-folder-card-text">
                    <span className="study-folder-name">{folder.name}</span>
                    {folder.description && <span className="study-folder-desc">{folder.description}</span>}
                  </div>
                  <span className="study-folder-count">{(itemsByFolder[folder.id] || []).length} items</span>
                </button>
                <button type="button" className="study-folder-edit" onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditFolderName(folder.name); setEditFolderDescription(folder.description || ''); }} aria-label="Edit folder">Edit</button>
                <button type="button" className="study-folder-delete" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} aria-label="Delete folder">×</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {folders.length === 0 && !showAddFolder && (
        <p className="study-empty">Create a folder to get started.</p>
      )}
    </div>
  );
}
