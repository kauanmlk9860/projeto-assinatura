class DocumentSignatureApp {
    constructor() {
        this.apiUrl = 'http://localhost:3002/api';
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.strokes = [];
        this.currentStroke = [];
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupTabs();
    }

    setupCanvas() {
        this.canvas = document.getElementById('signatureCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Configurar canvas
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Eventos do canvas
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Eventos touch para mobile
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
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    setupEventListeners() {
        // Upload de documentos
        document.getElementById('documents').addEventListener('change', (e) => {
            this.handleDocumentUpload(e);
        });
        
        // Upload de assinatura
        document.getElementById('signatureFile').addEventListener('change', (e) => {
            this.handleSignatureUpload(e);
        });
        
        // Controles do canvas
        document.getElementById('clearCanvas').addEventListener('click', () => {
            this.clearCanvas();
        });
        
        document.getElementById('undoCanvas').addEventListener('click', () => {
            this.undoLastStroke();
        });
        
        // Teste de detecção
        document.getElementById('testDetection').addEventListener('click', () => {
            this.testSignatureDetection();
        });
        
        // Formulário
        document.getElementById('documentForm').addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // Remover active de todos
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Ativar selecionado
                btn.classList.add('active');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(e);
        this.currentStroke = [coords];
        
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const coords = this.getCanvasCoordinates(e);
        this.currentStroke.push(coords);
        
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.strokes.push([...this.currentStroke]);
            this.currentStroke = [];
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
    }

    undoLastStroke() {
        if (this.strokes.length === 0) return;
        
        this.strokes.pop();
        this.redrawCanvas();
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.strokes.forEach(stroke => {
            if (stroke.length === 0) return;
            
            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);
            
            stroke.forEach(point => {
                this.ctx.lineTo(point.x, point.y);
            });
            
            this.ctx.stroke();
        });
    }

    handleDocumentUpload(e) {
        const files = Array.from(e.target.files);
        const listContainer = document.getElementById('documentsList');
        
        listContainer.innerHTML = '';
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">📄 ${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
            `;
            listContainer.appendChild(fileItem);
        });
    }

    handleSignatureUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('signaturePreview');
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Prévia da Assinatura">
                <p>Assinatura carregada: ${file.name}</p>
            `;
        };
        reader.readAsDataURL(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const documents = document.getElementById('documents').files;
        const signatureFile = document.getElementById('signatureFile').files[0];
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        
        // Validações
        if (documents.length === 0) {
            this.showMessage('Selecione pelo menos um documento', 'error');
            return;
        }
        
        if (activeTab === 'upload' && !signatureFile) {
            this.showMessage('Selecione uma imagem de assinatura', 'error');
            return;
        }
        
        if (activeTab === 'draw' && this.strokes.length === 0) {
            this.showMessage('Desenhe uma assinatura no canvas', 'error');
            return;
        }
        
        try {
            this.setLoading(true);
            await this.processDocuments(documents, signatureFile, activeTab);
        } catch (error) {
            this.showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async processDocuments(documents, signatureFile, signatureType) {
        const formData = new FormData();
        
        // Adicionar documentos
        Array.from(documents).forEach(doc => {
            formData.append('documents', doc);
        });
        
        // Adicionar assinatura
        if (signatureType === 'upload') {
            formData.append('signature', signatureFile);
        } else {
            // Converter canvas para base64
            const signatureData = this.canvas.toDataURL('image/png');
            formData.append('signatureData', signatureData);
        }
        
        const response = await fetch(`${this.apiUrl}/process-documents`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Erro no processamento');
        }
        
        const result = await response.json();
        this.displayResults(result.files);
        this.showMessage('Documentos processados com sucesso!', 'success');
    }

    displayResults(files) {
        const resultsSection = document.getElementById('results');
        const downloadLinks = document.getElementById('downloadLinks');
        
        downloadLinks.innerHTML = '';
        
        files.forEach(file => {
            const downloadItem = document.createElement('div');
            downloadItem.className = 'download-item';
            downloadItem.innerHTML = `
                <div class="file-info">
                    <div class="file-name">📄 ${file.name}</div>
                    <div class="file-status">✅ Processado com sucesso</div>
                </div>
                <button class="download-btn" onclick="app.downloadFile('${file.name}', '${file.data}')">
                    📥 Download
                </button>
            `;
            downloadLinks.appendChild(downloadItem);
        });
        
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    downloadFile(filename, base64Data) {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showMessage(`Download de ${filename} iniciado`, 'success');
        } catch (error) {
            this.showMessage(`Erro no download: ${error.message}`, 'error');
        }
    }

    setLoading(loading) {
        const btn = document.getElementById('processBtn');
        const form = document.getElementById('documentForm');
        
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
            form.style.pointerEvents = 'none';
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            form.style.pointerEvents = 'auto';
        }
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        
        messagesContainer.appendChild(messageEl);
        
        // Auto remove após 5 segundos
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
    }

    async testSignatureDetection() {
        const documents = document.getElementById('documents').files;
        
        if (documents.length === 0) {
            this.showMessage('Selecione um documento para testar a detecção', 'error');
            return;
        }
        
        const testBtn = document.getElementById('testDetection');
        const resultsDiv = document.getElementById('detectionResults');
        
        try {
            testBtn.disabled = true;
            testBtn.textContent = '🔍 Analisando...';
            
            // Testar apenas o primeiro documento
            const formData = new FormData();
            formData.append('document', documents[0]);
            
            const response = await fetch(`${this.apiUrl}/detect-signatures`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || 'Erro na detecção');
            }
            
            const result = await response.json();
            this.displayDetectionResults(result, resultsDiv);
            
        } catch (error) {
            this.showMessage(`Erro na detecção: ${error.message}`, 'error');
            resultsDiv.style.display = 'none';
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '🔍 Testar Detecção de Assinaturas';
        }
    }
    
    displayDetectionResults(result, container) {
        const { detectedLocations, summary, document } = result;
        
        container.innerHTML = `
            <div class="detection-summary">
                <h4>📊 Resultado da Análise - ${document}</h4>
                <div class="summary-stats">
                    <div class="stat-item">
                        <div class="stat-value">${summary.totalLocations}</div>
                        <div class="stat-label">Total Detectadas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${summary.underlineCount || 0}</div>
                        <div class="stat-label">Linhas de Sublinhado</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${summary.textCount || 0}</div>
                        <div class="stat-label">Textos "ASSINATURA"</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${(summary.averageConfidence * 100).toFixed(0)}%</div>
                        <div class="stat-label">Confiança Média</div>
                    </div>
                </div>
            </div>
            
            <div class="detected-locations">
                ${detectedLocations.map((location, index) => this.renderDetectedLocation(location, index + 1)).join('')}
            </div>
        `;
        
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        
        const typeBreakdown = summary.underlineCount > 0 && summary.textCount > 0 ? 
            ` (${summary.underlineCount} linha(s) + ${summary.textCount} texto(s))` : '';
        
        this.showMessage(`Detectadas ${summary.totalLocations} assinatura(s)${typeBreakdown} no documento`, 'success');
    }
    
    renderDetectedLocation(location, index) {
        const confidenceClass = location.confidence >= 0.8 ? 'confidence-high' : 
                               location.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low';
        
        const confidenceText = location.confidence >= 0.8 ? 'Alta' : 
                              location.confidence >= 0.6 ? 'Média' : 'Baixa';
        
        const typeIcon = location.type === 'underline' ? '📏' : '📝';
        const typeText = location.type === 'underline' ? 'Linha de Sublinhado' : 'Texto "ASSINATURA"';
        
        return `
            <div class="detected-location">
                <div class="location-header">
                    <div class="location-title">${typeIcon} Assinatura ${index} - ${typeText}</div>
                    <div class="confidence-badge ${confidenceClass}">
                        ${confidenceText} (${(location.confidence * 100).toFixed(0)}%)
                    </div>
                </div>
                
                <div class="location-details">
                    <div class="detail-row">
                        <div class="detail-label">Linha:</div>
                        <div class="detail-value">${location.lineIndex + 1}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">${location.type === 'underline' ? 'Sublinhado' : 'Texto'}:</div>
                        <div class="detail-value">"${location.lineParagraph}"</div>
                    </div>
                    ${location.type === 'underline' && location.nameParagraph !== location.lineParagraph ? `
                        <div class="detail-row">
                            <div class="detail-label">Nome:</div>
                            <div class="detail-value">"${location.nameParagraph}"</div>
                        </div>
                    ` : ''}
                    
                    ${location.context && (location.context.before.length > 0 || location.context.after.length > 0) ? `
                        <div class="context-section">
                            ${location.context.before.length > 0 ? `
                                <div class="context-label">Contexto anterior:</div>
                                <div class="context-text">${location.context.before.join(' | ')}</div>
                            ` : ''}
                            ${location.context.after.length > 0 ? `
                                <div class="context-label">Contexto posterior:</div>
                                <div class="context-text">${location.context.after.join(' | ')}</div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    resetForm() {
        document.getElementById('documentForm').reset();
        document.getElementById('documentsList').innerHTML = '';
        document.getElementById('signaturePreview').innerHTML = '';
        document.getElementById('results').style.display = 'none';
        document.getElementById('detectionResults').style.display = 'none';
        this.clearCanvas();
    }
}

// Inicializar aplicação
const app = new DocumentSignatureApp();

// Expor globalmente para uso nos botões
window.app = app;