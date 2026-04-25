import { useState, useEffect, useCallback, useRef } from "react";
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

  // Sync folder with URL ?folder=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("folder") || "";
    loadContents(folderParam);
  }, []);

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

  const getShareableLink = (key) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/view/${key}`;
  };

  const copyToClipboard = async (text, msg = "Link copied!") => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("✅ " + msg);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setStatus("❌ Failed to copy");
    }
  };

  const handleShareFile = async (e, key) => {
    e.stopPropagation();
    const longUrl = getShareableLink(key);
    
    setShortening(true);
    setStatus("Shortening link...");
    
    const finalUrl = await shortenUrl(longUrl);
    await copyToClipboard(finalUrl, "File link copied!");
    setShortening(false);
  };

  const handleShareFolder = async (e, path = null) => {
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
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = async (e, key) => {
    e.stopPropagation();
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
  };

  const handleDownload = async (e, fileUrl, fileName) => {
    e.stopPropagation();
    e.preventDefault();
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
  };

  const handleUpload = async (selectedFile) => {
    const fileToUpload = selectedFile || file;
    if (!fileToUpload) return;

    try {
      setLoading(true);
      setStatus("Preparing upload...");

      const res = await fetch("/.netlify/functions/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: fileToUpload.name,
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
    if (!newFolderName.trim()) return;
    const newPath = currentPath + newFolderName.trim() + "/";
    setCurrentPath(newPath);
    setFiles([]);
    setFolders([]);
    setNewFolderName("");
    setShowNewFolder(false);
    setStatus(`Navigated to new folder: ${newFolderName}`);
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

  const filteredFolders = folders.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const breadcrumbs = currentPath.split("/").filter(Boolean);
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="ag-page" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      {/* Header */}
      <header className="ag-header">
        <div className="ag-breadcrumb">
          <button 
            className="ag-breadcrumb-root ag-btn-link" 
            onClick={navigateToRoot}
            type="button"
          >
            root
          </button>
          {breadcrumbs.map((folder, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="ag-breadcrumb-sep">/</span>
              {idx === breadcrumbs.length - 1 ? (
                <span className="ag-breadcrumb-current">{folder}</span>
              ) : (
                <button 
                  className="ag-breadcrumb-item ag-btn-link"
                  onClick={() => navigateToBreadcrumb(idx)}
                  type="button"
                >
                  {folder}
                </button>
              )}
            </span>
          ))}
        </div>
        <h1 className="ag-page-title">
          {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : "Media Storage"}
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
          />
        </div>
        <button className="ag-btn" onClick={() => setShowNewFolder(!showNewFolder)}>
          <Plus size={16} />
          New Folder
        </button>
        <button className="ag-btn ag-btn--primary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          Upload
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => handleUpload(e.target.files[0])}
        />
      </div>

      {/* Dropzone */}
      <div 
        className={`ag-dropzone ${isDragging ? 'ag-dropzone--active' : ''}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="ag-dropzone-icon">
          <Upload size={20} />
        </div>
        <div className="ag-dropzone-label">Drop files here to upload</div>
        <div className="ag-dropzone-sub">or click to browse — max 100MB per file</div>
      </div>

      {/* Inline New Folder Row */}
      {showNewFolder && (
        <div className="ag-inline-row">
          <input 
            type="text" 
            className="ag-input" 
            placeholder="Folder name..." 
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <button className="ag-btn ag-btn--primary" onClick={handleCreateFolder}>Create</button>
          <button className="ag-btn" onClick={() => setShowNewFolder(false)}>Cancel</button>
        </div>
      )}

      {/* Section Header */}
      <div className="ag-section-header">
        <span className="ag-section-title">
          {searchTerm ? `Search Results for "${searchTerm}"` : `Directory: /${currentPath}`}
        </span>
        <div className="ag-view-toggle">
          <button className="ag-vbtn ag-vbtn--active"><Grid size={14} /></button>
          <button className="ag-vbtn"><ListIcon size={14} /></button>
        </div>
      </div>

      {/* File/Folder Grid */}
      <div className="ag-file-grid">
        {/* Folders */}
        {filteredFolders.map((folder) => (
          <div key={folder} className="ag-file-card" onClick={() => navigateTo(folder)}>
            <div className="ag-card-actions">
              <button 
                className="ag-icon-btn" 
                title="Share"
                onClick={(e) => handleShareFolder(e, currentPath + folder + "/")}
                disabled={shortening}
              >
                <Share2 size={14} />
              </button>
            </div>
            <div className="ag-file-icon ag-file-icon--folder">
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
          >
            <div className="ag-card-actions">
              <button 
                className="ag-icon-btn" 
                title="Download"
                onClick={(e) => handleDownload(e, file.url, file.name)}
              >
                <Download size={14} />
              </button>
              <button 
                className="ag-icon-btn" 
                title="Share"
                onClick={(e) => handleShareFile(e, file.key)}
                disabled={shortening}
              >
                <Share2 size={14} />
              </button>
              <button 
                className="ag-icon-btn ag-icon-btn--danger" 
                title="Delete"
                onClick={(e) => handleDelete(e, file.key)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className={`ag-file-icon ${getIconClass(file.name)}`}>
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
        <div className="ag-status-info">
          <span className={`ag-status-dot ${loading ? 'ag-status-dot--loading' : ''}`}></span>
          {status || `${filteredFolders.length + filteredFiles.length} items — ${formatSize(totalSize)}`}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ag-btn ag-btn--sm" onClick={() => loadContents(currentPath)}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
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