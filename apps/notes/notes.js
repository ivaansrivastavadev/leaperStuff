     // leprNotes by leaperStuff - Markdown Note-Taking App
class LeprNotes {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.currentMode = 'editing';
        this.isSidebarCollapsed = false;
        this.autoSaveInterval = null;
        this.lastSaveTime = null;
        this.navbarTimeout = null;
        this.livePreviewTimeout = null;
        this.saveTimeout = null;
        
        this.init();
    }

    init() {
        this.loadNotes();
        this.setupEventListeners();
        this.setupAutoSave();
        this.applyResponsiveMargins();
        this.setupMarkdownParser();
        
        // Ensure all modals are hidden on startup
        this.hideAllModals();
        
        // Load first note or create default
        if (this.notes.length > 0) {
            this.loadNote(this.notes[0].id);
        } else {
            this.createNewNote();
        }
        
        // Add sample data if empty
        if (this.notes.length === 0) {
            this.createSampleNotes();
        }
        
        this.renderNotesList();
    }

    // Data Management
    loadNotes() {
        const stored = localStorage.getItem('leprNotes_v1_notes');
        if (stored) {
            this.notes = JSON.parse(stored);
        }
    }

    saveNotes() {
        try {
            localStorage.setItem('leprNotes_v1_notes', JSON.stringify(this.notes));
            this.updateSaveIndicator();
            return true;
        } catch (e) {
            this.showError('Storage full. Please export some notes to free space.');
            return false;
        }
    }

    // Note CRUD Operations
    createNewNote() {
        const note = {
            id: Date.now().toString(),
            title: 'Untitled',
            content: '',
            tags: [],
            folder: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            versions: []
        };
        
        this.notes.unshift(note);
        this.saveNotes();
        this.loadNote(note.id);
        this.renderNotesList();
        
        return note;
    }

    loadNote(noteId) {
        this.saveCurrentNote(); // Save current before switching
        
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            this.currentNote = note;
            this.updateEditorContent();
            this.updateNoteTitle();
            this.updateTagsDisplay();
            this.renderPreview();
            this.renderNotesList();
        }
    }

    saveCurrentNote() {
        if (!this.currentNote) return;
        
        const content = this.getEditorContent();
        if (content !== this.currentNote.content) {
            this.currentNote.content = content;
            this.currentNote.updatedAt = new Date().toISOString();
            
            // Add to version history (limit to 50 versions)
            this.currentNote.versions.unshift({
                timestamp: new Date().toISOString(),
                content: content
            });
            
            if (this.currentNote.versions.length > 50) {
                this.currentNote.versions = this.currentNote.versions.slice(0, 50);
            }
            
            this.saveNotes();
            this.renderNotesList();
        }
    }

    duplicateNote() {
        if (!this.currentNote) return;
        
        const duplicate = {
            ...this.currentNote,
            id: Date.now().toString(),
            title: `${this.currentNote.title} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            versions: []
        };
        
        this.notes.unshift(duplicate);
        this.saveNotes();
        this.loadNote(duplicate.id);
        this.renderNotesList();
    }

    deleteNote() {
        if (!this.currentNote) return;
        
        const noteIndex = this.notes.findIndex(n => n.id === this.currentNote.id);
        if (noteIndex !== -1) {
            const deletedNote = this.notes.splice(noteIndex, 1)[0];
            this.saveNotes();
            
            // Store for potential undo
            localStorage.setItem('leprNotes_v1_lastDeleted', JSON.stringify(deletedNote));
            
            // Load next available note or create new
            if (this.notes.length > 0) {
                this.loadNote(this.notes[0].id);
            } else {
                this.createNewNote();
            }
            
            this.renderNotesList();
            this.showToast('Note deleted. <button id="undoDelete">Undo</button>', 5000);
            
            // Setup undo handler
            setTimeout(() => {
                const undoBtn = document.getElementById('undoDelete');
                if (undoBtn) {
                    undoBtn.onclick = () => this.undoDelete();
                }
            }, 100);
        }
    }

    undoDelete() {
        const deleted = localStorage.getItem('leprNotes_v1_lastDeleted');
        if (deleted) {
            const note = JSON.parse(deleted);
            this.notes.unshift(note);
            this.saveNotes();
            this.loadNote(note.id);
            this.renderNotesList();
            this.hideToast();
        }
    }

    // Editor & Preview
    getEditorContent() {
        switch (this.currentMode) {
            case 'editing':
                return document.getElementById('editor').value;
            case 'both':
                return document.getElementById('editorBoth').value;
            case 'live':
                return document.getElementById('liveEditor').innerText;
            default:
                return this.currentNote?.content || '';
        }
    }

    updateEditorContent() {
        if (!this.currentNote) return;
        
        const content = this.currentNote.content;
        document.getElementById('editor').value = content;
        document.getElementById('editorBoth').value = content;
        document.getElementById('liveEditor').innerText = content;
    }

    updateNoteTitle() {
        if (!this.currentNote) return;
        
        const title = this.currentNote.title;
        const titleElements = document.querySelectorAll('.note-title');
        titleElements.forEach(el => {
            if (!el.classList.contains('editable') || el.getAttribute('contenteditable') === 'false') {
                el.textContent = title;
            }
        });
    }

    updateTagsDisplay() {
        if (!this.currentNote) return;
        
        const tagsContainer = document.querySelectorAll('.note-tags');
        tagsContainer.forEach(container => {
            container.innerHTML = '';
            this.currentNote.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;
                container.appendChild(tagEl);
            });
        });
    }

    setupMarkdownParser() {
        // Custom renderer for underline support
        const renderer = new marked.Renderer();
        const originalParagraph = renderer.paragraph;
        
        // Add underline support using __text__
        renderer.paragraph = (text) => {
            // Process __text__ for underline
            text = text.replace(/__([^_]+)__/g, '<u>$1</u>');
            return originalParagraph.call(renderer, text);
        };
        
        marked.setOptions({
            renderer: renderer,
            breaks: true,
            gfm: true,
            tables: true
        });
    }

    renderPreview() {
        if (!this.currentNote) return;
        
        const content = this.currentNote.content;
        try {
            const html = marked.parse(content);
            document.getElementById('preview').innerHTML = html;
            document.getElementById('previewBoth').innerHTML = html;
        } catch (e) {
            document.getElementById('preview').innerHTML = '<p>Error rendering markdown</p>';
            document.getElementById('previewBoth').innerHTML = '<p>Error rendering markdown</p>';
        }
    }

    renderLivePreview() {
        if (this.livePreviewTimeout) {
            clearTimeout(this.livePreviewTimeout);
        }
        
        this.livePreviewTimeout = setTimeout(() => {
            if (this.currentNote && this.currentMode === 'live') {
                const content = document.getElementById('liveEditor').innerText;
                try {
                    const html = marked.parse(content);
                    document.getElementById('liveEditor').innerHTML = html;
                } catch (e) {
                    document.getElementById('liveEditor').innerHTML = '<p>Error rendering markdown</p>';
                }
            }
        }, 200);
    }

    // UI Management
    switchMode(mode) {
        this.currentMode = mode;
        
        // Hide all panels
        document.querySelectorAll('.mode-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        // Show selected panel
        switch (mode) {
            case 'editing':
                document.getElementById('editingMode').classList.remove('hidden');
                break;
            case 'preview':
                document.getElementById('previewMode').classList.remove('hidden');
                this.renderPreview();
                break;
            case 'both':
                document.getElementById('bothMode').classList.remove('hidden');
                this.renderPreview();
                break;
            case 'live':
                document.getElementById('liveMode').classList.remove('hidden');
                this.renderLivePreview();
                break;
        }
        
        // Update selector
        document.getElementById('modeSelect').value = mode;
    }

    renderNotesList() {
        const container = document.getElementById('notesList');
        container.innerHTML = '';
        
        this.notes
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .forEach(note => {
                const noteEl = document.createElement('div');
                noteEl.className = `note-item ${note.id === this.currentNote?.id ? 'active' : ''}`;
                noteEl.innerHTML = `
                    <div class="note-item-header">
                        <h3 class="note-item-title">${this.escapeHtml(note.title)}</h3>
                        <button class="note-actions-btn">⋯</button>
                    </div>
                    <div class="note-item-tags">
                        ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                    <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
                `;
                
                noteEl.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('note-actions-btn')) {
                        this.loadNote(note.id);
                    }
                });
                
                // Note actions
                const actionsBtn = noteEl.querySelector('.note-actions-btn');
                actionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showNoteActions(note, actionsBtn);
                });
                
                container.appendChild(noteEl);
            });
    }

    showNoteActions(note, button) {
        // Simple implementation - reuse navbar actions
        this.loadNote(note.id);
        document.getElementById('fileActionsBtn').click();
    }

    // Version History
    showVersionHistory() {
        if (!this.currentNote) return;
        
        const versionList = document.getElementById('versionList');
        versionList.innerHTML = '';
        
        // Add current version
        const currentVersion = document.createElement('div');
        currentVersion.className = 'version-item active';
        currentVersion.innerHTML = `
            <strong>Current Version</strong>
            <div>${new Date().toLocaleString()}</div>
        `;
        currentVersion.addEventListener('click', () => {
            this.restoreVersion(this.currentNote.content);
        });
        versionList.appendChild(currentVersion);
        
        // Add historical versions
        this.currentNote.versions.forEach((version, index) => {
            const versionEl = document.createElement('div');
            versionEl.className = 'version-item';
            versionEl.innerHTML = `
                <strong>Version ${index + 1}</strong>
                <div>${new Date(version.timestamp).toLocaleString()}</div>
            `;
            versionEl.addEventListener('click', () => {
                this.restoreVersion(version.content);
            });
            versionList.appendChild(versionEl);
        });
        
        this.showModal('versionModal');
    }

    restoreVersion(content) {
        if (!this.currentNote) return;
        
        this.currentNote.content = content;
        this.currentNote.updatedAt = new Date().toISOString();
        this.updateEditorContent();
        this.renderPreview();
        this.saveNotes();
        this.hideModal('versionModal');
        this.showToast('Version restored');
    }

    // Event Handlers
    setupEventListeners() {
        // Mode switching
        document.getElementById('modeSelect').addEventListener('change', (e) => {
            this.switchMode(e.target.value);
        });
        
        // Editor input
        document.getElementById('editor').addEventListener('input', () => {
            this.scheduleAutoSave();
        });
        
        document.getElementById('editorBoth').addEventListener('input', () => {
            this.scheduleAutoSave();
            this.renderPreview();
        });
        
        document.getElementById('liveEditor').addEventListener('input', () => {
            this.scheduleAutoSave();
            this.renderLivePreview();
        });
        
        // File actions
        document.getElementById('renameBtn').addEventListener('click', () => this.renameNote());
        document.getElementById('duplicateBtn').addEventListener('click', () => this.duplicateNote());
        document.getElementById('versionHistoryBtn').addEventListener('click', () => this.showVersionHistory());
        document.getElementById('deleteBtn').addEventListener('click', () => this.showDeleteModal());
        document.getElementById('exportMDBtn').addEventListener('click', () => this.exportAsMD());
        document.getElementById('exportJSONBtn').addEventListener('click', () => this.exportAsJSON());
        
        // Note title editing
        document.querySelectorAll('.note-title.editable').forEach(title => {
            title.addEventListener('click', () => {
                if (title.getAttribute('contenteditable') === 'false') {
                    title.setAttribute('contenteditable', 'true');
                    title.focus();
                    
                    // Select all text
                    const range = document.createRange();
                    range.selectNodeContents(title);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            });
            
            title.addEventListener('blur', () => {
                title.setAttribute('contenteditable', 'false');
                if (this.currentNote && title.textContent !== this.currentNote.title) {
                    this.currentNote.title = title.textContent;
                    this.currentNote.updatedAt = new Date().toISOString();
                    this.saveNotes();
                    this.renderNotesList();
                }
            });
            
            title.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    title.blur();
                }
            });
        });
        
        // New note button
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.createNewNote();
        });
        
        // Search
        document.getElementById('searchNotes').addEventListener('input', (e) => {
            this.filterNotes(e.target.value);
        });
        
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Modals
        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.deleteNote();
            this.hideModal('deleteModal');
        });
        
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.hideModal('deleteModal');
        });
        
        document.getElementById('closeVersionModal').addEventListener('click', () => {
            this.hideModal('versionModal');
        });
        
        // File actions dropdown
        document.getElementById('fileActionsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.querySelector('.dropdown-menu');
            menu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveCurrentNote();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('searchNotes').focus();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.insertLinkSyntax();
                        break;
                    case '/':
                        e.preventDefault();
                        this.togglePreview();
                        break;
                }
            }
            
            // Escape key
            if (e.key === 'Escape') {
                this.hideAllModals();
                document.querySelectorAll('.note-title[contenteditable="true"]').forEach(el => {
                    el.setAttribute('contenteditable', 'false');
                });
            }
        });
        
        // Navbar auto-hide
        document.addEventListener('mousemove', () => this.showNavbar());
        document.addEventListener('touchstart', () => this.showNavbar());
        document.addEventListener('focusin', (e) => {
            if (this.isMobile() && 
                (e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true')) {
                this.hideNavbar();
            }
        });
        
        // Responsive layout
        window.addEventListener('resize', () => {
            this.applyResponsiveMargins();
        });
    }

    // UI Utilities
    applyResponsiveMargins() {
        const container = document.querySelector('.app-container');
        if (window.innerWidth < 768) {
            container.style.margin = '2%';
        } else {
            container.style.margin = '10%';
        }
    }

    showNavbar() {
        const navbar = document.getElementById('navbar');
        navbar.classList.remove('hidden');
        
        if (this.navbarTimeout) {
            clearTimeout(this.navbarTimeout);
        }
        
        this.navbarTimeout = setTimeout(() => {
            if (!this.isMobile()) {
                navbar.classList.add('hidden');
            }
        }, 2000);
    }

    hideNavbar() {
        if (this.isMobile()) {
            document.getElementById('navbar').classList.add('hidden');
        }
    }

    isMobile() {
        return window.innerWidth < 768;
    }

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed');
    }

    showDeleteModal() {
        this.showModal('deleteModal');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.innerHTML = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            this.hideToast();
        }, duration);
    }

    hideToast() {
        document.getElementById('toast').classList.add('hidden');
    }

    updateSaveIndicator() {
        const indicator = document.getElementById('saveIndicator');
        this.lastSaveTime = new Date();
        indicator.textContent = `Saved ${this.lastSaveTime.toLocaleTimeString()}`;
    }

    // Auto-save functionality
    setupAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.saveCurrentNote();
        }, 60000); // 60 seconds
    }

    scheduleAutoSave() {
        // Debounced save for frequent edits
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveCurrentNote();
        }, 1000);
    }

    // Export functionality
    exportAsMD() {
        if (!this.currentNote) return;
        
        const content = `# ${this.currentNote.title}\n\n${this.currentNote.content}`;
        this.downloadFile(`${this.currentNote.title}.md`, content, 'text/markdown');
    }

    exportAsJSON() {
        const data = {
            exportedAt: new Date().toISOString(),
            notes: this.notes
        };
        
        this.downloadFile('leprNotes_export.json', JSON.stringify(data, null, 2), 'application/json');
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Additional features
    renameNote() {
        const title = document.querySelector('.note-title.editable');
        if (title) {
            title.setAttribute('contenteditable', 'true');
            title.focus();
            
            const range = document.createRange();
            range.selectNodeContents(title);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    insertLinkSyntax() {
        const editor = document.getElementById('editor');
        if (editor) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const selectedText = editor.value.substring(start, end);
            const linkText = selectedText || 'link text';
            const newText = `[${linkText}](url)`;
            
            editor.setRangeText(newText, start, end, 'select');
            editor.focus();
        }
    }

    togglePreview() {
        const currentMode = this.currentMode;
        if (currentMode === 'editing') {
            this.switchMode('preview');
        } else if (currentMode === 'preview') {
            this.switchMode('editing');
        }
    }

    filterNotes(query) {
        const notes = document.querySelectorAll('.note-item');
        notes.forEach(note => {
            const title = note.querySelector('.note-item-title').textContent.toLowerCase();
            const tags = Array.from(note.querySelectorAll('.tag')).map(tag => tag.textContent.toLowerCase());
            
            const matches = title.includes(query.toLowerCase()) || 
                           tags.some(tag => tag.includes(query.toLowerCase()));
            
            note.style.display = matches ? 'block' : 'none';
        });
    }

    // Utility functions
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    // Sample data for first-time users
    createSampleNotes() {
        const sampleNotes = [
            {
                id: 'sample1',
                title: 'Welcome to leprNotes',
                content: `# Welcome to leprNotes!

This is a **markdown-first** note-taking app with:

## Features
- __Underline support__ with double underscores
- *Italic* and **bold** text
- \`inline code\`
- Lists (ordered and unordered)
- [Links](https://example.com)
- Tables
- Code blocks

\`\`\`javascript
// Example code block
function hello() {
    console.log("Hello, leprNotes!");
}
\`\`\`

> This is a blockquote

Enjoy using leprNotes!`,
                tags: ['welcome', 'getting-started'],
                folder: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                versions: []
            },
            {
                id: 'sample2',
                title: 'Markdown Cheatsheet',
                content: `# Markdown Cheatsheet

## Text Formatting
- **Bold**: \`**text**\` or \`__text__\`
- *Italic*: \`*text*\` or \`_text_\`
- __Underline__: \`__text__\` (custom extension)
- ~~Strikethrough~~: \`~~text~~\`
- \`Inline code\`: \\\`code\\\`

## Lists
- Unordered list: \`- item\`
- Ordered list: \`1. item\`
- [ ] Task list: \`- [ ] task\`

## Other Elements
> Blockquote: \`> text\`

\`\`\`
Code block with triple backticks
\`\`\`

[Link](url): \`[text](url)\`

![Image](alt): \`![alt](url)\`

---

Horizontal rule: \`---\``,
                tags: ['reference', 'markdown'],
                folder: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                versions: []
            }
        ];
        
        this.notes = sampleNotes;
        this.saveNotes();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.leprNotes = new LeprNotes();
});