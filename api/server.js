const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const DocumentProcessor = require('./services/documentProcessor');

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do multer para upload temporário
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'doc-signature', uuidv4());
    fs.ensureDirSync(tempDir);
    req.tempDir = tempDir;
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'documents') {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos .docx são permitidos para documentos'));
      }
    } else if (file.fieldname === 'signature') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Apenas imagens são permitidas para assinatura'));
      }
    } else {
      cb(new Error('Campo de arquivo não reconhecido'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Endpoint principal para processamento
app.post('/api/process-documents', 
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'signature', maxCount: 1 }
  ]), 
  async (req, res) => {
    let tempDir = req.tempDir;
    
    try {
      const { documents, signature } = req.files;
      const { signatureData } = req.body; // Para assinatura desenhada

      if (!documents || documents.length === 0) {
        return res.status(400).json({ error: 'Nenhum documento foi enviado' });
      }

      if (!signature && !signatureData) {
        return res.status(400).json({ error: 'Assinatura é obrigatória' });
      }

      const processor = new DocumentProcessor(tempDir);
      
      // Processar assinatura
      let signaturePath;
      if (signature) {
        signaturePath = signature[0].path;
      } else {
        signaturePath = await processor.createSignatureFromCanvas(signatureData);
      }

      // Processar documentos
      const processedFiles = await processor.processDocuments(documents, signaturePath);
      
      // Retornar arquivos como download
      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        files: processedFiles.map(file => ({
          name: file.name,
          data: file.data.toString('base64')
        }))
      });

    } catch (error) {
      console.error('Erro no processamento:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    } finally {
      // Limpar arquivos temporários
      if (tempDir) {
        setTimeout(() => {
          fs.remove(tempDir).catch(console.error);
        }, 1000);
      }
    }
  }
);

// Endpoint para receber assinatura desenhada
app.post('/api/signature-canvas', express.raw({ type: 'image/*', limit: '2mb' }), (req, res) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'doc-signature', uuidv4());
    fs.ensureDirSync(tempDir);
    
    const signaturePath = path.join(tempDir, 'signature.png');
    fs.writeFileSync(signaturePath, req.body);
    
    res.json({ 
      success: true, 
      signaturePath,
      tempDir 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para testar detecção de assinaturas
app.post('/api/detect-signatures', 
  upload.single('document'), 
  async (req, res) => {
    let tempDir = req.tempDir;
    
    try {
      const document = req.file;
      
      if (!document) {
        return res.status(400).json({ error: 'Nenhum documento foi enviado' });
      }
      
      const SignatureDetector = require('./services/signatureDetector');
      const detector = new SignatureDetector();
      
      const locations = await detector.detectSignatureLocations(document.path);
      
      res.json({
        success: true,
        document: document.originalname,
        detectedLocations: locations.map(loc => ({
          type: loc.type || 'underline',
          lineIndex: loc.lineIndex,
          lineParagraph: loc.lineParagraph,
          nameParagraph: loc.nameParagraph,
          confidence: Math.round(loc.confidence * 100) / 100,
          context: {
            before: loc.context.before.slice(0, 2),
            after: loc.context.after.slice(0, 2)
          }
        })),
        summary: {
          totalLocations: locations.length,
          averageConfidence: Math.round((locations.reduce((sum, loc) => sum + loc.confidence, 0) / locations.length) * 100) / 100,
          highConfidenceCount: locations.filter(loc => loc.confidence >= 0.8).length,
          underlineCount: locations.filter(loc => loc.type === 'underline').length,
          textCount: locations.filter(loc => loc.type === 'text').length
        }
      });
      
    } catch (error) {
      console.error('Erro na detecção:', error);
      res.status(500).json({ 
        error: 'Erro na detecção de assinaturas',
        details: error.message 
      });
    } finally {
      // Limpar arquivos temporários
      if (tempDir) {
        setTimeout(() => {
          fs.remove(tempDir).catch(console.error);
        }, 1000);
      }
    }
  }
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;