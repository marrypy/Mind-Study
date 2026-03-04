import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStudyData, saveStudyData, id } from '../lib/studyStorage.js';
import { getSubscriptionTier } from '../lib/subscription.js';
import { canCreateStudyItems, recordStudyItems, FREE_ITEM_LIMIT_PER_WEEK } from '../lib/usageLimits.js';
import '../css/AddToFolderModal.css';

export default function AddToFolderModal({ item, userId: userIdProp, onClose, onAdded }) {
  const { user } = useAuth();
  const resolvedUserId = user?.id || userIdProp || null;
  const [folders, setFolders] = useState([]);
  const [itemsByFolder, setItemsByFolder] = useState({});
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!resolvedUserId) return;
    const data = loadStudyData(resolvedUserId);
    setFolders(data.folders || []);
    setItemsByFolder(data.itemsByFolder || {});
    setSelectedFolderId(data.folders?.[0]?.id || '');
  }, [resolvedUserId]);

  function handleCreateFolder() {
    const name = (newFolderName || '').trim();
    if (!name) return;
    const newFolder = { id: id(), name, description: '' };
    const nextFolders = [...folders, newFolder];
    const nextItems = { ...itemsByFolder, [newFolder.id]: [] };
    setFolders(nextFolders);
    setItemsByFolder(nextItems);
    setSelectedFolderId(newFolder.id);
    setNewFolderName('');
    setShowCreate(false);
    saveStudyData(resolvedUserId, { folders: nextFolders, itemsByFolder: nextItems });
  }

  function handleAdd() {
    const tier = getSubscriptionTier(user);
    const folderId = selectedFolderId || folders[0]?.id;
    if (!folderId) {
      setMessage('Please select or create a folder.');
      return;
    }
    const baseData = item?.data || {};
    let type = item?.type;
    if (type !== 'flashcards' && type !== 'study_guide' && type !== 'practice_test') type = 'study_guide';
    let localData;
    if (type === 'flashcards') localData = { cards: Array.isArray(baseData.cards) ? baseData.cards : [] };
    else if (type === 'practice_test') localData = { questions: Array.isArray(baseData.questions) ? baseData.questions : [] };
    else localData = { sections: Array.isArray(baseData.sections) ? baseData.sections : [] };
    const { allowed } = canCreateStudyItems(resolvedUserId, tier, 1);
    if (!allowed) {
      setMessage(`Free plan includes ${FREE_ITEM_LIMIT_PER_WEEK} study items per week. Upgrade to Pro for unlimited items.`);
      return;
    }
    const list = itemsByFolder[folderId] || [];
    const rawTitle = item?.title || 'Imported set';
    const title = rawTitle.length <= 50 ? rawTitle : rawTitle.slice(0, 50);
    const newItem = { id: id(), type, title, data: localData };
    const nextItems = { ...itemsByFolder, [folderId]: [...list, newItem] };
    saveStudyData(resolvedUserId, { folders, itemsByFolder: nextItems });
    recordStudyItems(resolvedUserId, 1);
    onAdded?.();
    onClose?.();
  }

  if (!item) return null;

  return (
    <div className="add-to-folder-overlay" role="dialog" aria-modal="true" aria-labelledby="add-to-folder-title" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="add-to-folder-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="add-to-folder-title" className="add-to-folder-title">Add to folder</h2>
        <p className="add-to-folder-item-name">{item.title}</p>
        <div className="add-to-folder-form">
          <label className="add-to-folder-label">Choose a class folder</label>
          <select
            className="add-to-folder-select"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            disabled={showCreate}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            {folders.length === 0 && <option value="">(No folders yet — create one below)</option>}
          </select>
          {!showCreate ? (
            <button type="button" className="add-to-folder-create-btn" onClick={() => setShowCreate(true)}>
              + Create new folder
            </button>
          ) : (
            <div className="add-to-folder-new">
              <input
                type="text"
                className="add-to-folder-input"
                placeholder="Folder name (e.g. Biology 101)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
                autoFocus
              />
              <div className="add-to-folder-new-actions">
                <button type="button" className="add-to-folder-btn add-to-folder-btn--primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Create &amp; use
                </button>
                <button type="button" className="add-to-folder-btn add-to-folder-btn--secondary" onClick={() => { setShowCreate(false); setNewFolderName(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {message && <p className="add-to-folder-message">{message}</p>}
          <div className="add-to-folder-actions">
            <button type="button" className="add-to-folder-btn add-to-folder-btn--primary" onClick={handleAdd}>
              Add to folder
            </button>
            <button type="button" className="add-to-folder-btn add-to-folder-btn--secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
