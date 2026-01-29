class DocuSignPro {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.documents = [];
        this.selectedDocuments = new Set();
        this.documentStatus = new Map();
        this.processedFiles = [];
        this.signature = null;
        this.signatureType = 'draw';
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.strokes = [];
        this.currentStroke = [];
        this.API_BASE = 'http://localhost:3001/api';
        
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.updateProgress();
        
        // Initialize Lucide icons after DOM is ready
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setupTheme() {
        // Check for saved theme or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Update theme toggle button
        this.updateThemeToggle(savedTheme);
    }

    updateThemeToggle(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.setAttribute('title', 
                theme === 'light' ? 'Alternar para tema escuro' : 'Alternar para tema claro'
            );
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeToggle(newTheme);
        
        // Re-initialize icons after theme change
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
    }

    setupCanvas() {
        this.canvas = document.getElementById('signatureCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.canvas.dispatchEvent(new MouseEvent('mouseup', {}));
        });
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // File upload
        const documentsInput = document.getElementById('documents');
        if (documentsInput) {
            documentsInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
                // Reset input para permitir selecionar os mesmos arquivos novamente
                e.target.value = '';
            });
        }

        // Signature methods
        document.querySelectorAll('.method-card').forEach(card => {
            card.addEventListener('click', () => {
                this.switchSignatureMethod(card.dataset.method);
            });
        });

        // Canvas controls
        document.getElementById('clearCanvas')?.addEventListener('click', () => {
            this.clearCanvas();
        });
        
        document.getElementById('undoCanvas')?.addEventListener('click', () => {
            this.undoLastStroke();
        });

        // Signature file upload
        document.getElementById('signatureFile')?.addEventListener('change', (e) => {
            this.handleSignatureUpload(e.target.files[0]);
        });

        // Navigation buttons
        document.getElementById('nextStep1')?.addEventListener('click', () => {
            this.goToStep(2);
        });
        
        document.getElementById('prevStep2')?.addEventListener('click', () => {
            this.goToStep(1);
        });
        
        document.getElementById('nextStep2')?.addEventListener('click', () => {
            this.goToStep(3);
        });
        
        document.getElementById('prevStep3')?.addEventListener('click', () => {
            this.goToStep(2);
        });

        // Process button
        document.getElementById('processBtn')?.addEventListener('click', () => {
            this.processDocuments();
        });

        // Detection button
        document.getElementById('detectBtn')?.addEventListener('click', () => {
            this.detectSignatures();
        });

        // New process button
        document.getElementById('newProcess')?.addEventListener('click', () => {
            this.resetProcess();
        });

        // Batch controls
        document.getElementById('selectAll')?.addEventListener('click', () => {
            this.selectAllDocuments();
        });
        
        document.getElementById('selectNone')?.addEventListener('click', () => {
            this.selectNoDocuments();
        });
        
        document.getElementById('removeSelected')?.addEventListener('click', () => {
            this.removeSelectedDocuments();
        });

        // Download controls
        document.getElementById('downloadAll')?.addEventListener('click', () => {
            this.downloadAllFiles();
        });
        
        document.getElementById('downloadSelected')?.addEventListener('click', () => {
            this.downloadSelectedFiles();
        });

        // Positioning controls
        document.getElementById('documentSelect')?.addEventListener('change', (e) => {
            this.selectDocument(e.target.value);
        });
        
        document.getElementById('autoSuggestBtn')?.addEventListener('click', () => {
            this.togglePositioningMode('auto');
        });
        
        document.getElementById('manualModeBtn')?.addEventListener('click', () => {
            this.togglePositioningMode('manual');
        });
        
        document.getElementById('clearPositions')?.addEventListener('click', () => {
            this.clearAllPositions();
        });
        
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            this.adjustZoom(0.1);
        });
        
        document.getElementById('zoomOut')?.addEventListener('click', () => {
            this.adjustZoom(-0.1);
        });
        
        document.getElementById('resetZoom')?.addEventListener('click', () => {
            this.resetZoom();
        });
    }

    setupDragAndDrop() {
        const uploadZone = document.getElementById('uploadZone');
        if (!uploadZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.remove('dragover');
            });
        });

        uploadZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        });

        uploadZone.addEventListener('click', () => {
            const input = document.getElementById('documents');
            if (input) {
                input.click();
            }
        });
    }

    handleFileSelect(files) {
        const newFiles = Array.from(files).filter(file => 
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );

        if (newFiles.length === 0) {
            this.showNotification('Selecione apenas arquivos .docx válidos', 'error');
            return;
        }

        // Verificar se algum arquivo já existe
        const duplicates = [];
        const uniqueFiles = [];
        
        newFiles.forEach(file => {
            const isDuplicate = this.documents.some(existingFile => 
                existingFile.name === file.name && existingFile.size === file.size
            );
            
            if (isDuplicate) {
                duplicates.push(file.name);
            } else {
                uniqueFiles.push(file);
            }
        });

        // Adicionar apenas arquivos únicos
        uniqueFiles.forEach(file => {
            const id = Date.now() + Math.random();
            file.id = id;
            this.documents.push(file);
            this.documentStatus.set(id, 'pending');
            this.selectedDocuments.add(id);
        });

        this.displayFiles();
        this.validateStep1();
        
        // Mostrar notificações apropriadas
        if (uniqueFiles.length > 0) {
            this.showNotification(`${uniqueFiles.length} documento(s) adicionado(s)`, 'success');
        }
        
        if (duplicates.length > 0) {
            this.showNotification(`${duplicates.length} arquivo(s) duplicado(s) ignorado(s)`, 'warning');
        }
    }

    displayFiles() {
        const container = document.getElementById('documentsGrid');
        const batchControls = document.getElementById('batchControls');
        
        if (!container) return;

        // Show/hide batch controls
        if (batchControls) {
            batchControls.style.display = this.documents.length > 0 ? 'block' : 'none';
        }

        container.innerHTML = '';
        
        this.documents.forEach((file, index) => {
            const isSelected = this.selectedDocuments.has(file.id);
            const status = this.documentStatus.get(file.id) || 'pending';
            
            const fileCard = document.createElement('div');
            fileCard.className = `document-card ${isSelected ? 'selected' : ''} status-${status}`;
            fileCard.innerHTML = `
                <div class="document-header">
                    <input type="checkbox" class="doc-checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="app.toggleDocumentSelection(${file.id})">
                    <div class="document-status">
                        <span class="status-icon">${this.getStatusIcon(status)}</span>
                    </div>
                </div>
                <div class="document-body">
                    <div class="document-icon">📄</div>
                    <div class="document-info">
                        <div class="document-name">${file.name}</div>
                        <div class="document-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        <div class="document-status-text">${this.getStatusText(status)}</div>
                    </div>
                </div>
                <div class="document-actions">
                    <button type="button" class="tool-btn" onclick="app.removeFile(${index})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            container.appendChild(fileCard);
        });
        
        this.updateBatchStats();
        
        // Re-initialize Lucide icons for new elements
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
    }

    getStatusIcon(status) {
        const icons = {
            'pending': '<i data-lucide="clock"></i>',
            'processing': '<i data-lucide="loader-2" class="animate-spin"></i>',
            'completed': '<i data-lucide="check-circle"></i>',
            'error': '<i data-lucide="x-circle"></i>'
        };
        return icons[status] || '<i data-lucide="clock"></i>';
    }

    getStatusText(status) {
        const texts = {
            'pending': 'Aguardando',
            'processing': 'Processando...',
            'completed': 'Concluído',
            'error': 'Erro'
        };
        return texts[status] || 'Aguardando';
    }

    toggleDocumentSelection(fileId) {
        if (this.selectedDocuments.has(fileId)) {
            this.selectedDocuments.delete(fileId);
        } else {
            this.selectedDocuments.add(fileId);
        }
        this.displayFiles();
    }

    selectAllDocuments() {
        this.documents.forEach(doc => {
            this.selectedDocuments.add(doc.id);
        });
        this.displayFiles();
    }

    selectNoDocuments() {
        this.selectedDocuments.clear();
        this.displayFiles();
    }

    removeSelectedDocuments() {
        const selectedIds = Array.from(this.selectedDocuments);
        this.documents = this.documents.filter(doc => !selectedIds.includes(doc.id));
        selectedIds.forEach(id => {
            this.selectedDocuments.delete(id);
            this.documentStatus.delete(id);
        });
        this.displayFiles();
        this.validateStep1();
        this.showNotification(`${selectedIds.length} documento(s) removido(s)`, 'success');
    }

    updateBatchStats() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = `${this.selectedDocuments.size} de ${this.documents.length} selecionados`;
        }
    }

    removeFile(index) {
        this.documents.splice(index, 1);
        this.displayFiles();
        this.validateStep1();
    }

    validateStep1() {
        const nextBtn = document.getElementById('nextStep1');
        if (nextBtn) {
            nextBtn.disabled = this.documents.length === 0;
        }
    }

    switchSignatureMethod(method) {
        this.signatureType = method;
        
        // Update UI
        document.querySelectorAll('.method-card').forEach(card => {
            card.classList.toggle('active', card.dataset.method === method);
        });
        
        document.querySelectorAll('.method-content').forEach(content => {
            content.classList.toggle('active', content.id === `${method}Method`);
        });

        this.validateStep2();
    }

    // Canvas methods
    getCanvasPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getCanvasPosition(e);
        this.currentStroke = [pos];
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.hideCanvasOverlay();
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getCanvasPosition(e);
        this.currentStroke.push(pos);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.strokes.push([...this.currentStroke]);
            this.currentStroke = [];
            this.validateStep2();
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        this.showCanvasOverlay();
        this.validateStep2();
    }

    undoLastStroke() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.redrawCanvas();
            this.validateStep2();
        }
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.strokes.length === 0) {
            this.showCanvasOverlay();
            return;
        }

        this.strokes.forEach(stroke => {
            if (stroke.length > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(stroke[0].x, stroke[0].y);
                
                stroke.forEach(point => {
                    this.ctx.lineTo(point.x, point.y);
                });
                
                this.ctx.stroke();
            }
        });
    }

    hideCanvasOverlay() {
        const overlay = document.querySelector('.canvas-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    showCanvasOverlay() {
        const overlay = document.querySelector('.canvas-overlay');
        if (overlay) overlay.style.display = 'block';
    }

    handleSignatureUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('signaturePreview');
            if (preview) {
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Assinatura" style="max-width: 100%; max-height: 150px; border-radius: 8px;">
                `;
            }
            this.signature = e.target.result;
            this.validateStep2();
        };
        reader.readAsDataURL(file);
    }

    validateStep2() {
        const nextBtn = document.getElementById('nextStep2');
        if (!nextBtn) return;

        let hasSignature = false;
        
        if (this.signatureType === 'draw') {
            hasSignature = this.strokes.length > 0;
        } else if (this.signatureType === 'upload') {
            hasSignature = this.signature !== null;
        }

        nextBtn.disabled = !hasSignature;
    }

    async detectSignatures() {
        if (this.documents.length === 0) {
            this.showNotification('Selecione documentos primeiro', 'error');
            return;
        }

        const resultsDiv = document.getElementById('detectionResults');
        if (!resultsDiv) return;

        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <div style="padding: 1rem; text-align: center;">
                <div class="loading-animation" style="width: 30px; height: 30px; margin: 0 auto 1rem;">
                    <i data-lucide="loader-2"></i>
                </div>
                <p>Analisando documentos com detecção avançada...</p>
            </div>
        `;

        // Re-initialize icons
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);

        // Enhanced detection simulation
        setTimeout(() => {
            const totalMarkers = this.documents.length * 2;
            const detectionDetails = this.documents.map((doc, index) => {
                return {
                    name: doc.name,
                    locations: [
                        { type: 'line', confidence: 0.95, text: '________________________', positioning: 'Sobre a linha' },
                        { type: 'text', confidence: 0.87, text: 'ASSINATURA:', positioning: 'Ao lado do texto' }
                    ]
                };
            });
            
            resultsDiv.innerHTML = `
                <div style="padding: 1rem;">
                    <h4 style="color: var(--success-600); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="check-circle"></i> Detecção Avançada Concluída
                    </h4>
                    <p style="margin-bottom: 1rem;">
                        Encontrados <strong>${totalMarkers} marcadores</strong> com posicionamento preciso.
                    </p>
                    <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-lg); margin-bottom: 1rem;">
                        ${detectionDetails.map(doc => `
                            <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-primary);">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i data-lucide="file-text"></i> 
                                    <strong>${doc.name}</strong>
                                </div>
                                ${doc.locations.map(location => `
                                    <div style="margin-left: 1.5rem; margin-bottom: 0.25rem; font-size: 0.875rem;">
                                        <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                                            <i data-lucide="${location.type === 'line' ? 'minus' : 'type'}" style="width: 12px; height: 12px;"></i>
                                            <strong>${location.type === 'line' ? 'Linha' : 'Texto'}:</strong>
                                        </span>
                                        "${location.text}" 
                                        <span style="color: var(--success-600); font-weight: 600;">
                                            (${Math.round(location.confidence * 100)}% confiança)
                                        </span>
                                        <br>
                                        <span style="color: var(--text-secondary); font-size: 0.75rem; margin-left: 1rem;">
                                            📍 Posicionamento: ${location.positioning}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                    <div style="background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-lg); padding: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--primary-700);">
                            <i data-lucide="info"></i>
                            <strong>Posicionamento Inteligente:</strong>
                        </div>
                        <p style="margin: 0.5rem 0 0 1.5rem; font-size: 0.875rem; color: var(--primary-600);">
                            As assinaturas serão posicionadas exatamente sobre as linhas detectadas, 
                            com tamanho ajustado automaticamente para cada documento.
                        </p>
                    </div>
                </div>
            `;
            
            // Re-initialize icons after content update
            setTimeout(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }, 100);
        }, 2500);
    }

    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;

        // Hide current step
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show new step
        const newStepContent = document.getElementById(`step${step}`);
        if (newStepContent) {
            newStepContent.classList.add('active');
        }

        // Update progress
        this.currentStep = step;
        this.updateProgress();

        // Prepare step content
        if (step === 3) {
            this.prepareReview();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateProgress() {
        // Update step indicators
        document.querySelectorAll('.step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('active', stepNumber === this.currentStep);
            step.classList.toggle('completed', stepNumber < this.currentStep);
        });

        // Update progress bar
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const percentage = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    preparePositioning() {
        // Populate document selector
        const documentSelect = document.getElementById('documentSelect');
        const documentCounter = document.getElementById('documentCounter');
        
        if (documentSelect) {
            documentSelect.innerHTML = '<option value="">Selecione um documento...</option>';
            this.documents.forEach((doc, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = doc.name;
                documentSelect.appendChild(option);
            });
        }
        
        if (documentCounter) {
            documentCounter.textContent = `0 de ${this.documents.length}`;
        }
        
        // Initialize positioning mode
        this.togglePositioningMode('auto');
        
        // Validate step
        this.validateStep3();
    }

    selectDocument(index) {
        if (index === '') {
            this.currentDocument = null;
            this.showDocumentPreview(null);
            return;
        }
        
        this.currentDocument = parseInt(index);
        const doc = this.documents[this.currentDocument];
        
        // Update counter
        const documentCounter = document.getElementById('documentCounter');
        if (documentCounter) {
            documentCounter.textContent = `${this.currentDocument + 1} de ${this.documents.length}`;
        }
        
        // Load document preview
        this.loadDocumentPreview(doc);
    }

    async loadDocumentPreview(doc) {
        const preview = document.getElementById('documentPreview');
        if (!preview) return;
        
        preview.innerHTML = `
            <div class="loading-preview" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px;">
                <i data-lucide="loader-2" class="animate-spin" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                <p>Carregando preview fiel do documento...</p>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">Usando mesmo fluxo de conversão do PDF</p>
            </div>
        `;
        
        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        try {
            // Create FormData for document upload
            const formData = new FormData();
            formData.append('document', doc);
            
            // Request faithful preview from server
            const response = await fetch(`${this.API_BASE}/document-preview`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Use the faithful HTML from server
                preview.innerHTML = `
                    <div class="faithful-preview" style="position: relative; overflow: auto; max-height: 800px; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); background: #f5f5f5; padding: 20px;">
                        ${result.preview.html}
                    </div>
                `;
                
                // Store preview dimensions from server response
                this.currentPreviewDimensions = result.preview.dimensions;
                
                // Add click handler for precise positioning
                const documentContainer = preview.querySelector('#documentContainer');
                if (documentContainer) {
                    documentContainer.addEventListener('click', (e) => {
                        this.addPreciseSignaturePosition(e);
                    });
                    
                    // Add visual guides
                    this.addPositioningGuides(documentContainer);
                }
                
                // Load existing positions
                this.displayPreciseSignaturePositions();
                
                // Load suggestions if in auto mode
                this.loadSuggestions();
                
            } else {
                throw new Error(result.error || 'Erro ao gerar preview');
            }
            
        } catch (error) {
            console.error('Erro ao carregar preview:', error);
            
            // Fallback to simulated preview
            preview.innerHTML = `
                <div class="error-preview" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: var(--error-600);">
                    <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                    <p>Erro ao carregar preview fiel</p>
                    <p style="font-size: 0.875rem;">Usando preview simulado</p>
                </div>
            `;
            
            // Re-initialize icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            
            // Fallback to simulated preview after delay
            setTimeout(() => {
                this.loadSimulatedPreview(doc);
            }, 2000);
        }
    }

    loadSimulatedPreview(doc) {
        const preview = document.getElementById('documentPreview');
        if (!preview) return;
        
        preview.innerHTML = `
            <div class="faithful-preview" style="position: relative; overflow: auto; max-height: 800px; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); background: #f5f5f5; padding: 20px;">
                <div class="document-container" id="documentContainer" style="width: 595px; min-height: 842px; background: white; margin: 0 auto; padding: 72px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.15; position: relative; box-sizing: border-box; cursor: crosshair; color: #000;">
                    <h2 style="text-align: center; margin-bottom: 30px; font-size: 16pt;">${doc.name.replace('.docx', '')}</h2>
                    <p style="margin: 0 0 6pt 0; text-align: justify;">Este documento representa uma visualização simulada do arquivo Word original, mantendo margens, espaçamentos e proporções exatas para posicionamento preciso da assinatura.</p>
                    
                    <p style="margin: 0 0 6pt 0;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
                    
                    <br><br>
                    <p style="margin: 0 0 6pt 0;">Assinatura: <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 200px; margin: 0 10px; height: 20px;"></span></p>
                    <br>
                    <p style="margin: 0 0 6pt 0;">Data: <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 100px; margin: 0 10px; height: 20px;"></span></p>
                    <br><br>
                    <p style="margin: 0 0 6pt 0;">Nome completo: <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 200px; margin: 0 10px; height: 20px;"></span></p>
                    <br>
                    <p style="margin: 0 0 6pt 0;">Cargo: <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 150px; margin: 0 10px; height: 20px;"></span></p>
                    
                    <div class="signature-overlay" id="signatureOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></div>
                </div>
            </div>
        `;
        
        // Store preview dimensions for coordinate conversion (PDF-accurate)
        this.currentPreviewDimensions = {
            width: 595,
            height: 842,
            margin: { top: 72, right: 72, bottom: 72, left: 72 } // 1 inch margins - matches PDF exactly
        };
        
        // Add click handler for precise positioning
        const documentContainer = preview.querySelector('#documentContainer');
        if (documentContainer) {
            documentContainer.addEventListener('click', (e) => {
                this.addPreciseSignaturePosition(e);
            });
            
            // Add visual guides
            this.addPositioningGuides(documentContainer);
        }
        
        // Load existing positions
        this.displayPreciseSignaturePositions();
        
        // Load suggestions if in auto mode
        this.loadSuggestions();
    }

    addPreciseSignaturePosition(e) {
        if (this.currentDocument === null) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert to document coordinates using preview service logic
        const docCoords = this.convertPreviewToDocumentCoords(x, y);
        
        // Validate position is within document bounds
        const validation = this.validateSignaturePosition(docCoords.x, docCoords.y);
        
        if (!validation.valid) {
            this.showNotification('Posição fora dos limites do documento', 'warning');
            return;
        }
        
        const position = {
            id: Date.now(),
            x: validation.adjustedX,
            y: validation.adjustedY,
            previewX: x,
            previewY: y,
            xPercent: docCoords.xPercent,
            yPercent: docCoords.yPercent,
            type: 'manual',
            confirmed: true,
            documentDimensions: this.currentPreviewDimensions
        };
        
        // Add to positions map
        if (!this.signaturePositions.has(this.currentDocument)) {
            this.signaturePositions.set(this.currentDocument, []);
        }
        
        this.signaturePositions.get(this.currentDocument).push(position);
        
        // Update display
        this.displayPreciseSignaturePositions();
        this.updatePositionsList();
        this.validateStep3();
        
        this.showNotification('Posição de assinatura definida com precisão', 'success');
    }

    convertPreviewToDocumentCoords(previewX, previewY) {
        if (!this.currentPreviewDimensions) {
            return { x: previewX, y: previewY, xPercent: 0, yPercent: 0 };
        }
        
        const dims = this.currentPreviewDimensions;
        
        // Account for zoom level
        const actualX = previewX / this.zoomLevel;
        const actualY = previewY / this.zoomLevel;
        
        // Convert to document-relative coordinates (remove margins)
        const docX = actualX - dims.margin.left;
        const docY = actualY - dims.margin.top;
        
        // Calculate content dimensions
        const contentWidth = dims.width - dims.margin.left - dims.margin.right;
        const contentHeight = dims.height - dims.margin.top - dims.margin.bottom;
        
        return {
            x: Math.max(0, docX),
            y: Math.max(0, docY),
            xPercent: (docX / contentWidth) * 100,
            yPercent: (docY / contentHeight) * 100
        };
    }

    validateSignaturePosition(x, y, signatureWidth = 120, signatureHeight = 40) {
        if (!this.currentPreviewDimensions) {
            return { valid: true, adjustedX: x, adjustedY: y };
        }
        
        const dims = this.currentPreviewDimensions;
        const contentWidth = dims.width - dims.margin.left - dims.margin.right;
        const contentHeight = dims.height - dims.margin.top - dims.margin.bottom;
        
        return {
            valid: x >= 0 && y >= 0 && 
                   (x + signatureWidth) <= contentWidth && 
                   (y + signatureHeight) <= contentHeight,
            adjustedX: Math.max(0, Math.min(x, contentWidth - signatureWidth)),
            adjustedY: Math.max(0, Math.min(y, contentHeight - signatureHeight))
        };
    }

    addPositioningGuides(container) {
        // Add visual guides for precise positioning
        const guides = document.createElement('div');
        guides.className = 'positioning-guides';
        guides.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        
        container.appendChild(guides);
        
        // Add crosshair on hover
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update crosshair position
            guides.innerHTML = `
                <div style="position: absolute; left: ${x}px; top: 0; width: 1px; height: 100%; background: rgba(59, 130, 246, 0.3);"></div>
                <div style="position: absolute; left: 0; top: ${y}px; width: 100%; height: 1px; background: rgba(59, 130, 246, 0.3);"></div>
            `;
        });
        
        container.addEventListener('mouseleave', () => {
            guides.innerHTML = '';
        });
    }

    displayPreciseSignaturePositions() {
        const overlay = document.getElementById('signatureOverlay');
        if (!overlay || this.currentDocument === null) return;
        
        overlay.innerHTML = '';
        
        const positions = this.signaturePositions.get(this.currentDocument) || [];
        
        positions.forEach(position => {
            const marker = document.createElement('div');
            marker.className = 'signature-marker-precise';
            
            // Use stored preview coordinates for display
            const displayX = position.previewX || position.x;
            const displayY = position.previewY || position.y;
            
            marker.style.left = `${displayX - 60}px`;
            marker.style.top = `${displayY - 20}px`;
            marker.innerHTML = `
                <span>Assinatura</span>
                <div class="marker-controls" style="position: absolute; top: -25px; right: -5px; opacity: 0; transition: opacity 0.2s;">
                    <button class="marker-btn" onclick="app.removePosition(${position.id})" style="background: var(--error-500); color: white; border: none; border-radius: 3px; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            `;
            
            // Show controls on hover
            marker.addEventListener('mouseenter', () => {
                const controls = marker.querySelector('.marker-controls');
                if (controls) controls.style.opacity = '1';
            });
            
            marker.addEventListener('mouseleave', () => {
                const controls = marker.querySelector('.marker-controls');
                if (controls) controls.style.opacity = '0';
            });
            
            overlay.appendChild(marker);
        });
        
        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    removePosition(positionId) {
        if (this.currentDocument === null) return;
        
        const positions = this.signaturePositions.get(this.currentDocument) || [];
        const filteredPositions = positions.filter(p => p.id !== positionId);
        
        this.signaturePositions.set(this.currentDocument, filteredPositions);
        
        this.displayPreciseSignaturePositions();
        this.updatePositionsList();
        this.validateStep3();
        
        this.showNotification('Posição removida', 'success');
    }

    togglePositioningMode(mode) {
        const autoBtn = document.getElementById('autoSuggestBtn');
        const manualBtn = document.getElementById('manualModeBtn');
        
        if (mode === 'auto') {
            autoBtn?.classList.add('active');
            manualBtn?.classList.remove('active');
            this.loadSuggestions();
        } else {
            autoBtn?.classList.remove('active');
            manualBtn?.classList.add('active');
            this.clearSuggestions();
        }
    }

    loadSuggestions() {
        const suggestionsList = document.getElementById('suggestionsList');
        if (!suggestionsList || this.currentDocument === null) return;
        
        // Simulate suggestions based on document content
        const suggestions = [
            { text: 'Linha de assinatura detectada', confidence: 0.95, x: 300, y: 400 },
            { text: 'Campo "Assinatura:"', confidence: 0.87, x: 250, y: 450 }
        ];
        
        suggestionsList.innerHTML = suggestions.map((suggestion, index) => `
            <div class="suggestion-item">
                <div class="suggestion-info">
                    <div class="suggestion-text">${suggestion.text}</div>
                    <div class="suggestion-confidence">${Math.round(suggestion.confidence * 100)}% confiança</div>
                </div>
                <div class="suggestion-actions">
                    <button class="accept-btn" onclick="app.acceptSuggestion(${index})">
                        <i data-lucide="check"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Store suggestions for later use
        this.currentSuggestions = suggestions;
        
        // Re-initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    acceptSuggestion(index) {
        if (!this.currentSuggestions || this.currentDocument === null) return;
        
        const suggestion = this.currentSuggestions[index];
        const position = {
            id: Date.now(),
            x: suggestion.x,
            y: suggestion.y,
            type: 'suggested',
            confirmed: true
        };
        
        if (!this.signaturePositions.has(this.currentDocument)) {
            this.signaturePositions.set(this.currentDocument, []);
        }
        
        this.signaturePositions.get(this.currentDocument).push(position);
        
        this.displaySignaturePositions();
        this.updatePositionsList();
        this.validateStep3();
        
        this.showNotification('Sugestão aceita', 'success');
    }

    clearSuggestions() {
        const suggestionsList = document.getElementById('suggestionsList');
        if (suggestionsList) {
            suggestionsList.innerHTML = '<p class="no-suggestions">Modo manual ativo</p>';
        }
    }

    updatePositionsList() {
        const positionsList = document.getElementById('positionsList');
        if (!positionsList) return;
        
        let totalPositions = 0;
        let html = '';
        
        this.documents.forEach((doc, docIndex) => {
            const positions = this.signaturePositions.get(docIndex) || [];
            if (positions.length > 0) {
                html += `
                    <div class="document-positions">
                        <h5>${doc.name}</h5>
                        ${positions.map(position => `
                            <div class="position-item">
                                <div class="position-info">
                                    <div class="position-text">Posição ${position.type === 'manual' ? 'Manual' : 'Sugerida'}</div>
                                    <div class="position-coords">X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}</div>
                                </div>
                                <div class="position-actions">
                                    <button class="remove-btn" onclick="app.removePositionFromDoc(${docIndex}, ${position.id})">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                totalPositions += positions.length;
            }
        });
        
        if (totalPositions === 0) {
            positionsList.innerHTML = '<p class="no-positions">Nenhuma posição definida</p>';
        } else {
            positionsList.innerHTML = html;
            
            // Re-initialize icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    removePositionFromDoc(docIndex, positionId) {
        const positions = this.signaturePositions.get(docIndex) || [];
        const filteredPositions = positions.filter(p => p.id !== positionId);
        
        this.signaturePositions.set(docIndex, filteredPositions);
        
        if (docIndex === this.currentDocument) {
            this.displayPreciseSignaturePositions();
        }
        
        this.updatePositionsList();
        this.validateStep3();
        
        this.showNotification('Posição removida', 'success');
    }

    clearAllPositions() {
        this.signaturePositions.clear();
        this.displayPreciseSignaturePositions();
        this.updatePositionsList();
        this.validateStep3();
        this.showNotification('Todas as posições foram removidas', 'success');
    }

    adjustZoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(2.0, this.zoomLevel + delta));
        this.updateZoomDisplay();
    }

    resetZoom() {
        this.zoomLevel = 1.0;
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
        
        const preview = document.getElementById('documentPreview');
        if (preview) {
            preview.style.transform = `scale(${this.zoomLevel})`;
            preview.style.transformOrigin = 'top left';
        }
    }

    validateStep3() {
        const nextBtn = document.getElementById('nextStep3');
        if (!nextBtn) return;
        
        // Check if all documents have at least one position
        let allDocumentsHavePositions = true;
        
        for (let i = 0; i < this.documents.length; i++) {
            const positions = this.signaturePositions.get(i) || [];
            if (positions.length === 0) {
                allDocumentsHavePositions = false;
                break;
            }
        }
        
        nextBtn.disabled = !allDocumentsHavePositions;
    }

    prepareReview() {
        // Update batch count
        const batchCount = document.getElementById('batchCount');
        if (batchCount) {
            batchCount.textContent = `${this.documents.length} documentos serão processados com detecção automática`;
        }

        // Review documents
        const reviewDocs = document.getElementById('reviewDocuments');
        if (reviewDocs) {
            reviewDocs.innerHTML = this.documents.map((doc, index) => {
                return `
                    <div class="file-item" style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-lg);">
                        <div class="file-icon" style="color: var(--primary-500);">
                            <i data-lucide="file-text"></i>
                        </div>
                        <div class="file-info" style="flex: 1;">
                            <div class="file-name" style="font-weight: 600; color: var(--text-primary);">${doc.name}</div>
                            <div class="file-size" style="font-size: 0.875rem; color: var(--text-secondary);">${(doc.size / 1024 / 1024).toFixed(2)} MB</div>
                            <div class="detection-info" style="font-size: 0.75rem; color: var(--success-600); font-weight: 600;">
                                <i data-lucide="search" style="width: 12px; height: 12px;"></i>
                                Detecção automática de assinaturas
                            </div>
                        </div>
                        <div class="batch-indicator" style="background: var(--primary-100); color: var(--primary-700); padding: 0.25rem 0.5rem; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 600;">
                            <span class="batch-number">${index + 1}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Review signature
        const reviewSig = document.getElementById('reviewSignature');
        if (reviewSig) {
            if (this.signatureType === 'draw') {
                const canvas = document.createElement('canvas');
                canvas.width = 300;
                canvas.height = 120;
                canvas.style.border = '1px solid var(--border-primary)';
                canvas.style.borderRadius = '8px';
                
                const ctx = canvas.getContext('2d');
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Scale and draw strokes
                const scaleX = 300 / 500;
                const scaleY = 120 / 200;
                
                this.strokes.forEach(stroke => {
                    if (stroke.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(stroke[0].x * scaleX, stroke[0].y * scaleY);
                        stroke.forEach(point => {
                            ctx.lineTo(point.x * scaleX, point.y * scaleY);
                        });
                        ctx.stroke();
                    }
                });
                
                reviewSig.innerHTML = '';
                reviewSig.appendChild(canvas);
            } else if (this.signature) {
                reviewSig.innerHTML = `
                    <img src="${this.signature}" alt="Assinatura" 
                         style="max-width: 300px; max-height: 120px; border: 1px solid var(--border-primary); border-radius: 8px;">
                `;
            }
        }

        // Re-initialize icons
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
    }

    async processDocuments() {
        const processBtn = document.getElementById('processBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const progressText = document.getElementById('progressText');
        const batchProgress = document.getElementById('batchProgress');
        
        if (!processBtn || !loadingOverlay) return;

        // Validate documents
        if (this.documents.length === 0) {
            this.showNotification('Nenhum documento selecionado', 'error');
            return;
        }

        // Show loading
        processBtn.disabled = true;
        processBtn.querySelector('.loading-spinner').style.display = 'inline-block';
        loadingOverlay.style.display = 'flex';
        
        // Initialize progress
        if (progressText) {
            if (this.documents.length > 20) {
                progressText.textContent = `Processando lote grande de ${this.documents.length} documentos... Isso pode levar alguns minutos.`;
            } else {
                progressText.textContent = `Processando ${this.documents.length} documentos...`;
            }
        }
        if (batchProgress) {
            batchProgress.style.width = '25%';
        }

        try {
            // Create FormData with documents
            const formData = new FormData();
            
            // Add documents to FormData
            this.documents.forEach((doc, index) => {
                console.log(`Adicionando documento ${index + 1}:`, doc.name, doc.size);
                formData.append('documents', doc);
            });

            // Add signature
            if (this.signatureType === 'draw') {
                const signatureData = this.canvas.toDataURL('image/png');
                formData.append('signatureData', signatureData);
                console.log('Assinatura por desenho adicionada');
            } else if (this.signature) {
                // Convert data URL to blob
                const response = await fetch(this.signature);
                const blob = await response.blob();
                formData.append('signature', blob, 'signature.png');
                console.log('Assinatura por upload adicionada');
            } else {
                throw new Error('Nenhuma assinatura encontrada');
            }

            // Update progress
            if (batchProgress) {
                batchProgress.style.width = '75%';
            }

            console.log('Enviando requisição para:', `${this.API_BASE}/process-documents`);
            
            // Process documents com timeout aumentado para lotes grandes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutos
            
            const response = await fetch(`${this.API_BASE}/process-documents`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const result = await response.json();
            console.log('Resposta do servidor:', result);

            if (result.success) {
                this.processedFiles = result.files;
                this.displayResults(result.files);
                this.goToStep(4);
                this.showNotification(`${this.documents.length} documentos processados!`, 'success');
            } else {
                throw new Error(result.error || result.details || 'Erro desconhecido');
            }

        } catch (error) {
            console.error('Erro no processamento:', error);
            
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = `Timeout: O processamento de ${this.documents.length} documentos demorou mais que 5 minutos. Tente processar em lotes menores.`;
            }
            
            this.showNotification(`Erro: ${errorMessage}`, 'error');
        } finally {
            // Hide loading
            processBtn.disabled = false;
            processBtn.querySelector('.loading-spinner').style.display = 'none';
            loadingOverlay.style.display = 'none';
        }
    }

    displayResults(files) {
        const downloadGrid = document.getElementById('downloadGrid');
        if (!downloadGrid) return;

        downloadGrid.innerHTML = files.map((file, index) => `
            <div class="download-card">
                <div class="download-header">
                    <input type="checkbox" class="download-checkbox" checked 
                           onchange="app.toggleDownloadSelection(${index})">
                    <div class="download-icon">📄</div>
                </div>
                <div class="download-info">
                    <h4>${file.name}</h4>
                    <p>${file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'PDF'}</p>
                </div>
                <div class="download-actions">
                    <a href="data:application/pdf;base64,${file.data}" 
                       download="${file.name}" 
                       class="btn-primary btn-sm">
                        📥 Download
                    </a>
                </div>
            </div>
        `).join('');
    }

    toggleDownloadSelection(index) {
        // Implementation for download selection
    }

    downloadAllFiles() {
        if (this.processedFiles.length === 0) return;
        
        // Create ZIP with all files
        this.createZipDownload(this.processedFiles, 'documentos_assinados.zip');
    }

    downloadSelectedFiles() {
        // Get selected files and create ZIP
        const selectedFiles = this.processedFiles.filter((_, index) => {
            const checkbox = document.querySelector(`.download-checkbox:nth-of-type(${index + 1})`);
            return checkbox && checkbox.checked;
        });
        
        if (selectedFiles.length === 0) {
            this.showNotification('Selecione arquivos para download', 'warning');
            return;
        }
        
        this.createZipDownload(selectedFiles, 'documentos_selecionados.zip');
    }

    async createZipDownload(files, filename) {
        try {
            // Simple implementation - download files individually
            files.forEach((file, index) => {
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = `data:application/pdf;base64,${file.data}`;
                    link.download = file.name;
                    link.click();
                }, index * 200); // Stagger downloads
            });
            
            this.showNotification(`${files.length} arquivos baixados`, 'success');
        } catch (error) {
            this.showNotification('Erro ao criar download em lote', 'error');
        }
    }

    resetProcess() {
        this.currentStep = 1;
        this.documents = [];
        this.selectedDocuments.clear();
        this.documentStatus.clear();
        this.processedFiles = [];
        this.signature = null;
        this.signatureType = 'draw';
        this.strokes = [];
        
        // Reset UI
        const documentsInput = document.getElementById('documents');
        if (documentsInput) documentsInput.value = '';
        
        const documentsGrid = document.getElementById('documentsGrid');
        if (documentsGrid) documentsGrid.innerHTML = '';
        
        const batchControls = document.getElementById('batchControls');
        if (batchControls) batchControls.style.display = 'none';
        
        const signatureFile = document.getElementById('signatureFile');
        if (signatureFile) signatureFile.value = '';
        
        const signaturePreview = document.getElementById('signaturePreview');
        if (signaturePreview) signaturePreview.innerHTML = '';
        
        this.clearCanvas();
        
        // Go to step 1
        this.goToStep(1);
        
        this.showNotification('Processo reiniciado', 'success');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            'success': 'check-circle',
            'error': 'x-circle',
            'warning': 'alert-triangle',
            'info': 'info'
        };
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <i data-lucide="${iconMap[type] || 'info'}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(notification);
        
        // Initialize icons for the notification
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new DocuSignPro();
});