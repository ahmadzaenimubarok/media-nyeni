import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Search, 
  Upload, 
  Plus, 
  Share2, 
  Trash2, 
  ChevronRight, 
  RefreshCw,
  MoreVertical,
  Download,
  Grid,
  List as ListIcon,
  X
} from "lucide-react";

import { shortenUrl } from "./utils/shortenUrl";
import { slugifyFile } from "./utils/slugify";

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentPath, setCurrentPath] = useState(""); 
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const filteredFolders = folders.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const allItems = useMemo(() => [
    ...filteredFolders.map(f => ({ type: 'folder', name: f })),
    ...filteredFiles.map(f => ({ type: 'file', ...f }))
  ], [filteredFolders, filteredFiles]);

  const updateURL = (path) => {
    const url = new URL(window.location);
    if (path) {
      url.searchParams.set("folder", path);
    } else {
      url.searchParams.delete("folder");
    }
    window.history.pushState({}, "", url);
  };

  const loadContents = useCallback(async (path) => {
    try {
      setLoading(true);
      const res = await fetch(`/.netlify/functions/files?folder=${encodeURIComponent(path)}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setFiles(data.files || []);
      setFolders(data.folders || []);
      setCurrentPath(data.currentFolder || "");
      updateURL(data.currentFolder || "");
    } catch (err) {
      console.error("Failed to load contents:", err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateTo = (folderName) => {
    const newPath = currentPath + folderName + "/";
    loadContents(newPath);
  };

  const navigateToRoot = () => loadContents("");

  const navigateToBreadcrumb = (idx) => {
    const parts = currentPath.split("/").filter(Boolean);
    const newPath = parts.slice(0, idx + 1).join("/") + "/";
    loadContents(newPath);
  };

  const getShareableLink = useCallback((key) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/view/${key}`;
  }, []);

  const copyToClipboard = useCallback(async (text, msg = "Link copied!") => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("✅ " + msg);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setStatus("❌ Failed to copy");
    }
  }, []);

  const handleShareFile = useCallback(async (e, key) => {
    if (e) e.stopPropagation();
    const longUrl = getShareableLink(key);
    
    setShortening(true);
    setStatus("Shortening link...");
    
    const finalUrl = await shortenUrl(longUrl);
    await copyToClipboard(finalUrl, "File link copied!");
    setShortening(false);
  }, [getShareableLink, copyToClipboard]);

  const handleShareFolder = useCallback(async (e, path = null) => {
    if (e) e.stopPropagation();
    
    const folderPath = path !== null ? path : currentPath;
    const baseUrl = window.location.origin;
    const longUrl = folderPath 
      ? `${baseUrl}/?folder=${encodeURIComponent(folderPath)}`
      : baseUrl;

    setShortening(true);
    setStatus("Shortening folder link...");
    
    const finalUrl = await shortenUrl(longUrl);
    await copyToClipboard(finalUrl, "Folder link copied!");
    setShortening(false);
  }, [currentPath, copyToClipboard]);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = useCallback(async (e, key) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      setStatus("Deleting...");
      await fetch("/.netlify/functions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setStatus("Item deleted");
      loadContents(currentPath);
    } catch (err) {
      setStatus("Delete failed: " + err.message);
    }
  }, [currentPath, loadContents]);

  const handleDownload = useCallback(async (e, fileUrl, fileName) => {
    if (e) e.stopPropagation();
    if (e) e.preventDefault();
    try {
      setStatus("Downloading...");
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setStatus("");
    } catch (err) {
      console.error("Download failed:", err);
      setStatus("❌ Download failed");
    }
  }, []);

  const handleUpload = async (selectedFile) => {
    const fileToUpload = selectedFile || file;
    if (!fileToUpload) return;

    try {
      setLoading(true);
      setStatus("Preparing upload...");

      const slugifiedName = slugifyFile(fileToUpload.name);

      const res = await fetch("/.netlify/functions/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: slugifiedName,
          contentType: fileToUpload.type,
          folder: currentPath
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStatus("Uploading to storage...");

      const uploadRes = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": fileToUpload.type },
        body: fileToUpload,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      setStatus("✅ Upload successful!");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      loadContents(currentPath);
    } catch (err) {
      console.error(err);
      setStatus("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;
    
    if (trimmedName.includes(" ")) {
      setStatus("❌ Folder name cannot contain spaces. Use dash (-) instead.");
      return;
    }

    const newPath = currentPath + trimmedName + "/";
    setCurrentPath(newPath);
    setFiles([]);
    setFolders([]);
    setNewFolderName("");
    setShowNewFolder(false);
    setStatus(`Navigated to new folder: ${trimmedName}`);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleUpload(droppedFile);
    }
  };

  const getFileIcon = (filename) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return <ImageIcon size={18} stroke="#4ade80" />;
    if (filename.match(/\.(txt|md|pdf|doc|docx)$/i)) return <FileText size={18} stroke="#60a5fa" />;
    return <File size={18} stroke="#8b95a8" />;
  };

  const getIconClass = (filename) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return "ag-file-icon--img";
    if (filename.match(/\.(txt|md|pdf|doc|docx)$/i)) return "ag-file-icon--txt";
    return "ag-file-icon--other";
  };

  // Sync folder with URL ?folder=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("folder") || "";
    loadContents(folderParam);
  }, [loadContents]);

  // Keyboard Shortcuts: Arrows for navigation, Backspace for back
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Backspace to go back to parent folder
      if (e.key === 'Backspace') {
        if (currentPath) {
          e.preventDefault();
          const parts = currentPath.split("/").filter(Boolean);
          const parentPath = parts.length > 1 
            ? parts.slice(0, -1).join("/") + "/" 
            : "";
          loadContents(parentPath);
        }
      }

      // Arrow Key Navigation and Item Actions
      const grid = document.querySelector('.ag-file-grid');
      if (grid) {
        const cards = Array.from(grid.querySelectorAll('.ag-file-card'));
        const currentIndex = cards.indexOf(document.activeElement);

        // If an item is focused, handle item-specific shortcuts
        if (currentIndex !== -1) {
          const item = allItems[currentIndex];

          // Ctrl + C: Copy Link (Shortened)
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (item.type === 'folder') handleShareFolder(null, currentPath + item.name + "/");
            else handleShareFile(null, item.key);
          }

          // Ctrl + S: Download (Files only)
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (item.type === 'file') handleDownload(null, item.url, item.name);
          }

          // Delete: Delete Item (Files only)
          if (e.key === 'Delete') {
            e.preventDefault();
            if (item.type === 'file') handleDelete(null, item.key);
          }
        }

        // Arrow Navigation logic
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          if (cards.length === 0) return;
          
          if (currentIndex === -1) {
            cards[0].focus();
            return;
          }

          e.preventDefault();
          const gridStyle = window.getComputedStyle(grid);
          const columns = gridStyle.getPropertyValue('grid-template-columns').split(' ').length;

          let nextIndex = currentIndex;
          switch (e.key) {
            case 'ArrowLeft':  nextIndex = Math.max(0, currentIndex - 1); break;
            case 'ArrowRight': nextIndex = Math.min(cards.length - 1, currentIndex + 1); break;
            case 'ArrowUp':    nextIndex = Math.max(0, currentIndex - columns); break;
            case 'ArrowDown':  nextIndex = Math.min(cards.length - 1, currentIndex + columns); break;
            default: break;
          }

          if (cards[nextIndex]) cards[nextIndex].focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentPath, loadContents, allItems, handleShareFile, handleShareFolder, handleDownload, handleDelete]);

  const breadcrumbs = currentPath.split("/").filter(Boolean);
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="ag-page" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <a href="#main-content" className="ag-skip-link">Skip to content</a>
      
      {/* Header */}
      <header className="ag-header">
        <nav className="ag-breadcrumb" aria-label="Breadcrumb">
          <button 
            className="ag-breadcrumb-root ag-btn-link" 
            onClick={navigateToRoot}
            type="button"
            aria-label="Go to root directory"
          >
            root
          </button>
          {breadcrumbs.map((folder, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="ag-breadcrumb-sep" aria-hidden="true">/</span>
              {idx === breadcrumbs.length - 1 ? (
                <span className="ag-breadcrumb-current" aria-current="page">{folder}</span>
              ) : (
                <button 
                  className="ag-breadcrumb-item ag-btn-link"
                  onClick={() => navigateToBreadcrumb(idx)}
                  type="button"
                  aria-label={`Go to ${folder}`}
                >
                  {folder}
                </button>
              )}
            </span>
          ))}
        </nav>
        <h1 className="ag-page-title">
          {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : "Media Nyeni"}
        </h1>
      </header>

      {/* Toolbar */}
      <div className="ag-toolbar">
        <div className="ag-search-wrap">
          <Search className="ag-search-icon" size={16} />
          <input 
            type="text" 
            className="ag-search" 
            placeholder="Search files and folders..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search files and folders"
          />
        </div>
        <button 
          className="ag-btn" 
          onClick={() => setShowNewFolder(!showNewFolder)}
          aria-expanded={showNewFolder}
          aria-controls="new-folder-row"
        >
          <Plus size={16} />
          New Folder
        </button>
        <button 
          className="ag-btn ag-btn--primary" 
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload file"
        >
          <Upload size={16} />
          Upload
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => handleUpload(e.target.files[0])}
          aria-hidden="true"
          tabIndex="-1"
        />
      </div>

      {/* Dropzone */}
      <div 
        className={`ag-dropzone ${isDragging ? 'ag-dropzone--active' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex="0"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="File upload dropzone. Click or drop files here."
      >
        <div className="ag-dropzone-icon">
          <Upload size={20} />
        </div>
        <div className="ag-dropzone-label">Drop files here to upload</div>
        <div className="ag-dropzone-sub">or click to browse — max 100MB per file</div>
      </div>

      {/* Inline New Folder Row */}
      {showNewFolder && (
        <div className="ag-inline-row" id="new-folder-row">
          <input 
            type="text" 
            className="ag-input" 
            placeholder="Folder name..." 
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
            aria-label="New folder name"
          />
          <button className="ag-btn ag-btn--primary" onClick={handleCreateFolder}>Create</button>
          <button className="ag-btn" onClick={() => setShowNewFolder(false)}>Cancel</button>
        </div>
      )}

      {/* Section Header */}
      <div className="ag-section-header" id="main-content" tabIndex="-1">
        <span className="ag-section-title">
          {searchTerm ? `Search Results for "${searchTerm}"` : `Directory: /${currentPath}`}
        </span>
        <div className="ag-view-toggle">
          <button className="ag-vbtn ag-vbtn--active" aria-label="Grid view" aria-pressed="true"><Grid size={14} /></button>
          <button className="ag-vbtn" aria-label="List view" aria-pressed="false"><ListIcon size={14} /></button>
        </div>
      </div>

      {/* File/Folder Grid */}
      <div className="ag-file-grid">
        {/* Folders */}
        {filteredFolders.map((folder) => (
          <div 
            key={folder} 
            className="ag-file-card" 
            onClick={() => navigateTo(folder)}
            role="button"
            tabIndex="0"
            onKeyDown={(e) => e.key === 'Enter' && navigateTo(folder)}
            aria-label={`Folder: ${folder}`}
          >
            <div className="ag-card-actions">
              <button 
                className="ag-icon-btn" 
                title="Share folder"
                onClick={(e) => handleShareFolder(e, currentPath + folder + "/")}
                disabled={shortening}
                aria-label={`Share folder ${folder}`}
              >
                <Share2 size={14} />
              </button>
            </div>
            <div className="ag-file-icon ag-file-icon--folder" aria-hidden="true">
              <Folder size={18} stroke="#7c6af7" />
            </div>
            <div className="ag-file-name">{folder}</div>
            <div className="ag-file-meta">Folder</div>
          </div>
        ))}

        {/* Files */}
        {filteredFiles.map((file) => (
          <div 
            key={file.key} 
            className="ag-file-card" 
            onClick={() => window.open(file.url, '_blank')}
            role="button"
            tabIndex="0"
            onKeyDown={(e) => e.key === 'Enter' && window.open(file.url, '_blank')}
            aria-label={`File: ${file.name}, size ${formatSize(file.size)}`}
          >
            <div className="ag-card-actions">
              <button 
                className="ag-icon-btn" 
                title="Download"
                onClick={(e) => handleDownload(e, file.url, file.name)}
                aria-label={`Download ${file.name}`}
              >
                <Download size={14} />
              </button>
              <button 
                className="ag-icon-btn" 
                title="Share"
                onClick={(e) => handleShareFile(e, file.key)}
                disabled={shortening}
                aria-label={`Share ${file.name}`}
              >
                <Share2 size={14} />
              </button>
              <button 
                className="ag-icon-btn ag-icon-btn--danger" 
                title="Delete"
                onClick={(e) => handleDelete(e, file.key)}
                aria-label={`Delete ${file.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className={`ag-file-icon ${getIconClass(file.name)}`} aria-hidden="true">
              {getFileIcon(file.name)}
            </div>
            <div className="ag-file-name" title={file.name}>{file.name}</div>
            <div className="ag-file-meta">{formatSize(file.size)}</div>
          </div>
        ))}

        {/* Empty State */}
        {filteredFolders.length === 0 && filteredFiles.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--ag-text-tertiary)', background: 'var(--ag-bg-elevated)', borderRadius: 'var(--ag-radius-lg)', border: '0.5px dashed var(--ag-border)' }}>
            No items found in this directory.
          </div>
        )}
      </div>

      {/* Status Bar */}
      <footer className="ag-status-bar">
        <div className="ag-status-info" role="status" aria-live="polite">
          <span className={`ag-status-dot ${loading ? 'ag-status-dot--loading' : ''}`} aria-hidden="true"></span>
          {status || `${filteredFolders.length + filteredFiles.length} items — ${formatSize(totalSize)}`}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ag-btn ag-btn--sm" onClick={() => loadContents(currentPath)} aria-label="Refresh list">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <button 
            className="ag-btn ag-btn--sm" 
            onClick={(e) => handleShareFolder(e)}
            disabled={shortening}
          >
            <Share2 size={12} className={shortening ? 'animate-spin' : ''} />
            {shortening ? "Sharing..." : "Share Folder"}
          </button>
        </div>
      </footer>

      {/* Tailwind-like utility for spin if not defined */}
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;