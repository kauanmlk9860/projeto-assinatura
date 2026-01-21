const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const SignatureDetector = require('./signatureDetector');

class DocumentProcessor {
  constructor(tempDir) {
    this.tempDir = tempDir;
    this.signatureDetector = new SignatureDetector();
  }

  async createSignatureFromCanvas(signatureData) {
    try {
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const signaturePath = path.join(this.tempDir, 'canvas-signature.png');
      
      // Processar assinatura do canvas com melhor qualidade
      await sharp(buffer)
        .resize(250, 100, { 
          fit: 'inside',
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fundo transparente
        })
        .png({ 
          compressionLevel: 6,
          adaptiveFiltering: true
        })
        .toFile(signaturePath);
      
      return signaturePath;
    } catch (error) {
      throw new Error(`Erro ao processar assinatura do canvas: ${error.message}`);
    }
  }

  async processSignatureImage(signaturePath) {
    try {
      const processedPath = path.join(this.tempDir, 'processed-signature.png');
      
      // Processar imagem com fundo transparente e otimização
      await sharp(signaturePath)
        .resize(250, 100, { 
          fit: 'inside',
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fundo transparente
        })
        .png({ 
          compressionLevel: 6,
          adaptiveFiltering: true
        })
        .toFile(processedPath);
      
      return processedPath;
    } catch (error) {
      throw new Error(`Erro ao processar imagem da assinatura: ${error.message}`);
    }
  }

  async processDocuments(documents, signaturePath) {
    const processedFiles = [];
    
    const processedSignature = await this.processSignatureImage(signaturePath);
    
    for (const doc of documents) {
      try {
        const pdfBuffer = await this.convertDocxToPDF(doc.path, processedSignature);
        
        processedFiles.push({
          name: path.basename(doc.originalname, '.docx') + '_assinado.pdf',
          data: pdfBuffer
        });
      } catch (error) {
        console.error(`Erro ao processar ${doc.originalname}:`, error);
        throw new Error(`Falha ao processar ${doc.originalname}: ${error.message}`);
      }
    }
    
    return processedFiles;
  }

  async convertDocxToPDF(docxPath, signaturePath) {
    try {
      // Usar detector automático para encontrar locais de assinatura
      const detectionResult = await this.signatureDetector.processDocumentWithDetectedSignatures(docxPath);
      
      console.log(`Detectadas ${detectionResult.detectedLocations.length} assinaturas com confiança média de ${detectionResult.summary.averageConfidence.toFixed(2)}`);
      
      return await this.createPDFWithSignature(
        detectionResult.processedText, 
        signaturePath, 
        detectionResult.detectedLocations,
        detectionResult.summary
      );
    } catch (error) {
      throw new Error(`Erro na conversão para PDF: ${error.message}`);
    }
  }

  async createPDFWithSignature(text, signaturePath, detectedLocations = [], summary = null) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        
        // Configurar fonte e layout
        doc.fontSize(12);
        doc.font('Helvetica');
        
        // Adicionar metadados sobre detecção
        if (summary) {
          doc.info.Title = 'Documento com Assinatura Digital';
          doc.info.Subject = `${summary.totalLocations} assinaturas detectadas automaticamente`;
        }
        
        const lines = text.split('\n');
        let y = 50;
        const pageWidth = 500;
        const pageMargin = 50;
        const maxSignatureWidth = 180;
        const maxSignatureHeight = 70;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Detectar marcadores de assinatura
          if (line.includes('[ASSINATURA_ACIMA_LINHA]') || line.includes('[ASSINATURA_ACIMA_TEXTO]')) {
            const isUnderline = line.includes('[ASSINATURA_ACIMA_LINHA]');
            const cleanLine = line.replace(/\[ASSINATURA_[^\]]+\]/, '').trim();
            
            // Verificar se há espaço suficiente na página
            if (y > 650) {
              doc.addPage();
              y = 50;
            }
            
            // Calcular dimensões proporcionais da assinatura
            const signatureDimensions = this.calculateSignatureDimensions(
              signaturePath, maxSignatureWidth, maxSignatureHeight
            );
            
            // Posicionamento baseado no tipo de detecção
            if (isUnderline) {
              // Para linhas de sublinhado: centralizar acima da linha
              y += 15; // Espaçamento superior
              
              const signatureX = pageMargin + (pageWidth - signatureDimensions.width) / 2;
              doc.image(signaturePath, signatureX, y, signatureDimensions);
              
              y += signatureDimensions.height + 8; // Pequeno espaço antes da linha
              
              // Adicionar a linha de sublinhado original
              if (cleanLine) {
                doc.text(cleanLine, pageMargin, y, { width: pageWidth, align: 'center' });
                y += 20;
              }
            } else {
              // Para texto "ASSINATURA": posicionar acima do texto
              y += 10;
              
              const signatureX = pageMargin + (pageWidth - signatureDimensions.width) / 2;
              doc.image(signaturePath, signatureX, y, signatureDimensions);
              
              y += signatureDimensions.height + 12; // Espaço antes do texto
              
              // Adicionar o texto original
              if (cleanLine) {
                doc.text(cleanLine, pageMargin, y, { width: pageWidth, align: 'center' });
                y += 20;
              }
            }
          } else if (line.trim()) {
            // Verificar quebra de página
            if (y > 700) {
              doc.addPage();
              y = 50;
            }
            
            doc.text(line, pageMargin, y, { width: pageWidth });
            y += 20;
          } else {
            // Linha vazia
            y += 10;
          }
        }
        
        // Adicionar rodapé com informações da detecção
        if (summary && summary.totalLocations > 0) {
          const footerY = doc.page.height - 50;
          doc.fontSize(8)
             .fillColor('gray')
             .text(
               `Processamento automático: ${summary.underlineCount || 0} linha(s) + ${summary.textCount || 0} texto(s) detectado(s)`,
               pageMargin, footerY, 
               { width: pageWidth, align: 'center' }
             );
        }
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Novo método para calcular dimensões proporcionais da assinatura
  calculateSignatureDimensions(signaturePath, maxWidth, maxHeight) {
    try {
      // Para este exemplo, usar dimensões padrão proporcionais
      // Em implementação real, seria ideal ler as dimensões da imagem
      const aspectRatio = 2.5; // Proporção típica de assinatura (largura/altura)
      
      let width = maxWidth;
      let height = width / aspectRatio;
      
      // Ajustar se altura exceder o máximo
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
      
      return {
        width: Math.round(width),
        height: Math.round(height),
        fit: [width, height] // Para manter proporção
      };
    } catch (error) {
      // Fallback para dimensões padrão
      return {
        width: 150,
        height: 60,
        fit: [150, 60]
      };
    }
  }
}

module.exports = DocumentProcessor;