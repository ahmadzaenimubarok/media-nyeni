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
  X,
  Keyboard
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
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "grid"); // 'grid' or 'list'
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

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

  const loadContents = useCallback(async (path, search = "", isGlobal = false) => {
    try {
      setLoading(true);
      const query = search ? `&q=${encodeURIComponent(search)}&isGlobal=${isGlobal}` : "";
      const res = await fetch(`/.netlify/functions/files?folder=${encodeURIComponent(path)}${query}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setFiles(data.files || []);
      setFolders(data.folders || []);
      
      if (!data.isSearch) {
        setCurrentPath(data.currentFolder || "");
        updateURL(data.currentFolder || "");
        setIsSearching(false);
      } else {
        setIsSearching(true);
        setStatus(`Showing ${data.isGlobal ? 'global' : 'local'} search results for "${search}"`);
      }
    } catch (err) {
      console.error("Failed to load contents:", err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateTo = (folderName) => {
    // If folderName is a path (contains /), use it directly, otherwise append to currentPath
    const newPath = folderName.includes("/") ? folderName : currentPath + folderName + "/";
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
      setIsUploading(true);
      setUploadingFile(fileToUpload);
      setUploadProgress(0);
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

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setStatus("✅ Upload successful!");
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadContents(currentPath);
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("PUT", data.url);
        xhr.setRequestHeader("Content-Type", fileToUpload.type);
        xhr.send(fileToUpload);
      });

    } catch (err) {
      console.error(err);
      setStatus("❌ " + err.message);
    } finally {
      setLoading(false);
      // Keep progress visible for a moment after success
      setTimeout(() => {
        setIsUploading(false);
        setUploadingFile(null);
        setUploadProgress(0);
      }, 2000);
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

  // Persist viewMode
  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  // Keyboard Shortcuts: Arrows for navigation, Backspace for back
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Alt + N: New Folder
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNewFolder(true);
      }

      // Alt + U: Upload File
      if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        fileInputRef.current?.click();
      }

      // Ctrl + F: Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
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
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              if (val === "" && isSearching) {
                loadContents(currentPath);
              }
            }}
            aria-label="Search files and folders"
            ref={searchInputRef}
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
        {searchTerm && (
          <button 
            className="ag-btn ag-btn--secondary" 
            onClick={() => loadContents(currentPath, searchTerm, true)}
            title="Search in all folders"
          >
            <Search size={16} />
            Global Search
          </button>
        )}
        <button 
          className="ag-btn ag-btn--icon" 
          onClick={() => setShowShortcuts(true)}
          title="Keyboard Shortcuts"
          aria-label="View keyboard shortcuts"
        >
          <Keyboard size={16} />
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
          <button 
            className={`ag-vbtn ${viewMode === 'grid' ? 'ag-vbtn--active' : ''}`} 
            onClick={() => setViewMode('grid')}
            aria-label="Grid view" 
            aria-pressed={viewMode === 'grid'}
          >
            <Grid size={14} />
          </button>
          <button 
            className={`ag-vbtn ${viewMode === 'list' ? 'ag-vbtn--active' : ''}`} 
            onClick={() => setViewMode('list')}
            aria-label="List view" 
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon size={14} />
          </button>
        </div>
      </div>

      {/* File/Folder Grid */}
      <div className={`ag-file-grid ${viewMode === 'list' ? 'ag-file-grid--list' : ''}`}>
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
            <div className="ag-file-name" title={folder}>{folder.split('/').filter(Boolean).pop()}</div>
            <div className="ag-file-meta">{folder.includes('/') ? folder : 'Folder'}</div>
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
            <div className="ag-file-meta">{file.fullPath ? file.fullPath : formatSize(file.size)}</div>
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

      {/* Upload Progress Overlay */}
      {isUploading && uploadingFile && (
        <div className="ag-upload-overlay" role="status" aria-live="polite">
          <div className="ag-upload-header">
            <div className="ag-upload-title">
              <Upload size={14} className="animate-spin" />
              {uploadProgress === 100 ? "Processing..." : "Uploading..."}
            </div>
            <div className="ag-status-info" style={{ fontSize: 'var(--ag-text-xs)' }}>
              {uploadProgress}%
            </div>
          </div>
          <div className="ag-upload-filename">{uploadingFile.name}</div>
          <div className="ag-progress-container">
            <div 
              className="ag-progress-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="ag-upload-stats">
            <span>{formatSize((uploadingFile.size * uploadProgress) / 100)} of {formatSize(uploadingFile.size)}</span>
          </div>
        </div>
      )}

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
      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className='ag-modal-overlay' onClick={() => setShowShortcuts(false)}>
          <div className='ag-modal' onClick={(e) => e.stopPropagation()} role='dialog' aria-modal='true' aria-labelledby='shortcuts-title'>
            <div className='ag-modal-header'>
              <h2 id='shortcuts-title' className='ag-modal-title'>Keyboard Shortcuts</h2>
              <button className='ag-icon-btn' onClick={() => setShowShortcuts(false)} aria-label='Close'>
                <X size={18} />
              </button>
            </div>
            <div className='ag-modal-body'>
              <div className='ag-shortcut-grid'>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Arrows</span>
                  <span className='ag-shortcut-desc'>Navigate items</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Enter</span>
                  <span className='ag-shortcut-desc'>Open folder/file</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Backspace</span>
                  <span className='ag-shortcut-desc'>Back to parent folder</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Ctrl + F</span>
                  <span className='ag-shortcut-desc'>Focus search box</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Alt + N</span>
                  <span className='ag-shortcut-desc'>Create new folder</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Alt + U</span>
                  <span className='ag-shortcut-desc'>Upload new file</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Ctrl + C</span>
                  <span className='ag-shortcut-desc'>Copy shareable link</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Ctrl + S</span>
                  <span className='ag-shortcut-desc'>Download selected file</span>
                </div>
                <div className='ag-shortcut-item'>
                  <span className='ag-shortcut-key'>Delete</span>
                  <span className='ag-shortcut-desc'>Delete selected file</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;