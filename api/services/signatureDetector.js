const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

class SignatureDetector {
  constructor() {
    this.minUnderlineLength = 6; // Mínimo de caracteres sublinhados
    this.maxDistanceToName = 3; // Máximo de linhas entre sublinhado e nome
    this.minNameLength = 3; // Mínimo de caracteres para nome
    this.maxNameLength = 100; // Máximo de caracteres para nome
  }

  async detectSignatureLocations(docxPath) {
    try {
      // Extrair texto bruto preservando estrutura
      const result = await mammoth.extractRawText({ path: docxPath });
      const text = result.value;
      
      // Analisar o texto para encontrar padrões de assinatura
      const signatureLocations = this.analyzeTextForSignatures(text);
      
      if (signatureLocations.length === 0) {
        throw new Error('Nenhum local válido de assinatura foi identificado no documento');
      }
      
      // Filtrar e ordenar por confiança
      const validLocations = signatureLocations
        .filter(loc => loc.confidence >= 0.6)
        .sort((a, b) => b.confidence - a.confidence);
      
      if (validLocations.length === 0) {
        throw new Error('Nenhum local válido de assinatura foi identificado no documento');
      }
      
      return validLocations;
    } catch (error) {
      throw new Error(`Erro na detecção de assinaturas: ${error.message}`);
    }
  }

  analyzeTextForSignatures(text) {
    const locations = [];
    const lines = text.split('\n').map((line, index) => ({ text: line.trim(), originalIndex: index }));
    const nonEmptyLines = lines.filter(line => line.text.length > 0);
    
    // 1️⃣ Detecção por linha de sublinhado (prioridade alta)
    for (let i = 0; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i];
      
      if (this.hasSignatureLine(line.text)) {
        const nameInfo = this.findNameAfterLine(nonEmptyLines, i);
        
        if (nameInfo) {
          const confidence = this.calculateConfidence(line.text, nameInfo.paragraph, nonEmptyLines, i, 'underline');
          
          locations.push({
            type: 'underline',
            lineIndex: line.originalIndex,
            lineParagraph: line.text,
            nameIndex: nameInfo.originalIndex,
            nameParagraph: nameInfo.paragraph,
            confidence: confidence,
            context: this.getContext(nonEmptyLines, i)
          });
        }
      }
    }
    
    // 2️⃣ Detecção por texto "ASSINATURA" (prioridade menor)
    for (let i = 0; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i];
      
      if (this.hasSignatureText(line.text)) {
        // Verificar se já não existe uma detecção por linha próxima
        const hasNearbyUnderline = locations.some(loc => 
          Math.abs(loc.lineIndex - line.originalIndex) <= 3
        );
        
        if (!hasNearbyUnderline) {
          const confidence = this.calculateConfidence(line.text, line.text, nonEmptyLines, i, 'text');
          
          locations.push({
            type: 'text',
            lineIndex: line.originalIndex,
            lineParagraph: line.text,
            nameIndex: line.originalIndex,
            nameParagraph: line.text,
            confidence: confidence,
            context: this.getContext(nonEmptyLines, i)
          });
        }
      }
    }
    
    // Remover duplicatas e aplicar hierarquia
    return this.prioritizeAndFilterLocations(locations);
  }

  hasSignatureLine(text) {
    const cleanText = text.trim();
    
    if (cleanText.length < this.minUnderlineLength || cleanText.length > 150) {
      return false;
    }
    
    // Padrões de linha de assinatura mais específicos e robustos
    const underlinePatterns = [
      /__{6,}/, // Sequência de underscores duplos
      /_{6,}/, // Sequência de underlines
      /\-{6,}/, // Sequência de hífens
      /\.{10,}/, // Sequência longa de pontos
      /\s*_{3,}\s+_{3,}/, // Múltiplas sequências separadas
      /^\s*[_\-\.]{6,}\s*$/, // Linha apenas com caracteres de sublinhado
      /[_\-]{3,}\s*[_\-]{3,}/, // Padrões intercalados
    ];
    
    // Verificar padrões básicos
    const hasUnderlinePattern = underlinePatterns.some(pattern => pattern.test(cleanText));
    
    if (!hasUnderlinePattern) return false;
    
    // Análise de densidade de caracteres especiais
    const specialChars = (cleanText.match(/[_\-\.]/g) || []).length;
    const totalChars = cleanText.length;
    const specialDensity = specialChars / totalChars;
    
    // Deve ter alta densidade de caracteres especiais (>50%)
    if (specialDensity < 0.5) return false;
    
    // Verificar se não é apenas formatação de tabela ou separador
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(cleanText);
    const letterCount = (cleanText.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    const letterDensity = letterCount / totalChars;
    
    // Se tem letras, deve ser baixa densidade (<30%)
    if (hasLetters && letterDensity > 0.3) return false;
    
    // Padrões que NÃO são linhas de assinatura
    const excludePatterns = [
      /^\s*[=]{3,}\s*$/, // Linhas de igual (separadores)
      /^\s*[\*]{3,}\s*$/, // Linhas de asterisco
      /^\s*[#]{3,}\s*$/, // Linhas de hashtag
      /^\s*[+]{3,}\s*$/, // Linhas de mais
    ];
    
    return !excludePatterns.some(pattern => pattern.test(cleanText));
  }

  findNameAfterLine(lines, lineIndex) {
    // Procurar nas próximas linhas por um possível nome
    for (let i = lineIndex + 1; i <= Math.min(lineIndex + this.maxDistanceToName, lines.length - 1); i++) {
      const line = lines[i];
      
      if (line.text.length === 0) continue; // Pular linhas vazias
      
      if (this.looksLikeName(line.text)) {
        return {
          index: i,
          originalIndex: line.originalIndex,
          paragraph: line.text
        };
      }
    }
    
    // Se não encontrou nome logo abaixo, procurar também acima (caso a linha esteja abaixo do nome)
    for (let i = Math.max(0, lineIndex - this.maxDistanceToName); i < lineIndex; i++) {
      const line = lines[i];
      
      if (line.text.length === 0) continue;
      
      if (this.looksLikeName(line.text)) {
        return {
          index: i,
          originalIndex: line.originalIndex,
          paragraph: line.text
        };
      }
    }
    
    return null;
  }

  looksLikeName(text) {
    const cleanText = text.trim();
    
    // Verificações básicas de tamanho
    if (cleanText.length < this.minNameLength || cleanText.length > this.maxNameLength) {
      return false;
    }
    
    // Remover caracteres especiais para análise, mantendo acentos
    const textForAnalysis = cleanText.replace(/[^a-zA-ZÀ-ÿ\s\.\-]/g, '').trim();
    if (textForAnalysis.length < this.minNameLength) return false;
    
    // Verificar se não é linha de formatação
    if (/^[_\-\.\s=\*#\+]+$/.test(cleanText)) return false;
    
    // Padrões que indicam nome/razão social
    const namePatterns = [
      // Nomes próprios (primeira letra maiúscula)
      /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+)*$/,
      
      // Razão social com sufixos
      /\b(LTDA|S\.A\.|S\/A|EIRELI|ME|EPP|LIMITADA|SOCIEDADE ANÔNIMA)\b/i,
      
      // Nomes em maiúsculas (comum em documentos formais)
      /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{3,}$/,
      
      // Nomes com pontos (abreviações)
      /^[A-Za-zÀ-ÿ]+(?:\.[A-Za-zÀ-ÿ]+)*(?:\s+[A-Za-zÀ-ÿ]+(?:\.[A-Za-zÀ-ÿ]+)*)*$/,
      
      // Padrão geral para texto alfabético
      /^[A-Za-zÀ-ÿ\s\-\.]{3,}$/
    ];
    
    // Verificar densidade de letras (deve ser alta para ser nome)
    const letterCount = (textForAnalysis.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    const letterDensity = letterCount / textForAnalysis.length;
    
    if (letterDensity < 0.7) return false; // Pelo menos 70% letras
    
    // Verificar padrões de nome
    const matchesPattern = namePatterns.some(pattern => pattern.test(textForAnalysis));
    
    // Verificações adicionais para aumentar precisão
    const hasReasonableWordCount = textForAnalysis.split(/\s+/).length <= 8; // Máximo 8 palavras
    const notTooManyNumbers = (cleanText.match(/\d/g) || []).length <= cleanText.length * 0.2; // Máximo 20% números
    
    return matchesPattern && hasReasonableWordCount && notTooManyNumbers;
  }

  calculateConfidence(lineParagraph, nameParagraph, allLines, currentIndex, detectionType) {
    let confidence = detectionType === 'underline' ? 0.5 : 0.3; // Base diferenciada por tipo
    
    if (detectionType === 'underline') {
      // Análise da linha de sublinhado
      const underlineLength = (lineParagraph.match(/[_\-]/g) || []).length;
      if (underlineLength >= 15) confidence += 0.25;
      else if (underlineLength >= 10) confidence += 0.15;
      else if (underlineLength >= 6) confidence += 0.1;
      
      // Densidade de caracteres especiais na linha
      const specialDensity = underlineLength / lineParagraph.length;
      if (specialDensity >= 0.8) confidence += 0.15;
      else if (specialDensity >= 0.6) confidence += 0.1;
      
      // Análise do nome
      if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(nameParagraph)) confidence += 0.2;
      if (/\b(LTDA|S\.A\.|S\/A|EIRELI|ME|EPP)\b/i.test(nameParagraph)) confidence += 0.15;
    } else if (detectionType === 'text') {
      // Análise do texto "ASSINATURA"
      const text = lineParagraph.toLowerCase();
      
      // Verificar variações da palavra assinatura
      if (text.includes('assinatura')) {
        confidence += 0.3;
        
        // Bonus para contextos específicos
        if (text.includes('contratante') || text.includes('contratado')) confidence += 0.15;
        if (text.includes('testemunha') || text.includes('responsável')) confidence += 0.1;
        if (text.includes('cliente') || text.includes('fornecedor')) confidence += 0.1;
        
        // Penalizar se tem muito texto junto (pode ser apenas menção)
        const words = text.split(/\s+/).length;
        if (words > 5) confidence -= 0.1;
        if (words > 10) confidence -= 0.2;
      }
    }
    
    // Análise do contexto (comum para ambos os tipos)
    const context = this.getContext(allLines, currentIndex);
    const signatureContextWords = [
      'assinatura', 'assina', 'testemunha', 'contratante', 'contratado',
      'responsável', 'representante', 'diretor', 'gerente', 'presidente',
      'data', 'local', 'cidade'
    ];
    
    const contextText = context.before.concat(context.after).join(' ').toLowerCase();
    const contextMatches = signatureContextWords.filter(word => contextText.includes(word)).length;
    confidence += Math.min(contextMatches * 0.05, 0.15);
    
    // Posicionamento no documento
    const totalLines = allLines.length;
    if (currentIndex < totalLines * 0.1 || currentIndex > totalLines * 0.95) {
      confidence -= 0.1;
    }
    
    if (currentIndex > totalLines * 0.7) {
      confidence += 0.1;
    }
    
    return Math.max(0.0, Math.min(confidence, 1.0));
  }
  
  getContext(lines, currentIndex) {
    const contextRange = 3;
    const before = [];
    const after = [];
    
    // Linhas antes
    for (let i = Math.max(0, currentIndex - contextRange); i < currentIndex; i++) {
      if (lines[i] && lines[i].text.trim()) {
        before.push(lines[i].text.trim());
      }
    }
    
    // Linhas depois
    for (let i = currentIndex + 1; i <= Math.min(lines.length - 1, currentIndex + contextRange); i++) {
      if (lines[i] && lines[i].text.trim()) {
        after.push(lines[i].text.trim());
      }
    }
    
    return { before, after };
  }
  
  removeDuplicateLocations(locations) {
    if (locations.length <= 1) return locations;
    
    const filtered = [];
    const minDistance = 5; // Mínimo de linhas entre assinaturas
    
    locations.sort((a, b) => a.lineIndex - b.lineIndex);
    
    for (const location of locations) {
      const tooClose = filtered.some(existing => 
        Math.abs(existing.lineIndex - location.lineIndex) < minDistance
      );
      
      if (!tooClose) {
        filtered.push(location);
      } else {
        // Se estão próximas, manter a de maior confiança
        const closeIndex = filtered.findIndex(existing => 
          Math.abs(existing.lineIndex - location.lineIndex) < minDistance
        );
        
        if (closeIndex !== -1 && location.confidence > filtered[closeIndex].confidence) {
          filtered[closeIndex] = location;
        }
      }
    }
    
    return filtered;
  }

  // Novo método para detectar texto "ASSINATURA"
  hasSignatureText(text) {
    const cleanText = text.toLowerCase().trim();
    
    // Padrões para detectar variações de "ASSINATURA"
    const signaturePatterns = [
      /\bassinatura\b/i,
      /\bassina\b/i,
      /\bassinado\b/i,
      /\bassinar\b/i
    ];
    
    return signaturePatterns.some(pattern => pattern.test(cleanText));
  }

  // Novo método para aplicar hierarquia de prioridade
  prioritizeAndFilterLocations(locations) {
    if (locations.length === 0) return locations;
    
    // Separar por tipo
    const underlineLocations = locations.filter(loc => loc.type === 'underline');
    const textLocations = locations.filter(loc => loc.type === 'text');
    
    // Se existem linhas de sublinhado, priorizar elas
    if (underlineLocations.length > 0) {
      // Filtrar textos que estão muito próximos de linhas
      const filteredTextLocations = textLocations.filter(textLoc => {
        return !underlineLocations.some(underlineLoc => 
          Math.abs(underlineLoc.lineIndex - textLoc.lineIndex) <= 5
        );
      });
      
      // Combinar e remover duplicatas
      const combined = [...underlineLocations, ...filteredTextLocations];
      return this.removeDuplicateLocations(combined);
    }
    
    // Se não há linhas, usar apenas textos
    return this.removeDuplicateLocations(textLocations);
  }

  // Método para processar documento com locais detectados
  async processDocumentWithDetectedSignatures(docxPath) {
    const locations = await this.detectSignatureLocations(docxPath);
    
    // Extrair texto completo para processamento
    const result = await mammoth.extractRawText({ path: docxPath });
    let text = result.value;
    
    // Marcar locais de assinatura no texto
    const lines = text.split('\n');
    
    // Processar de trás para frente para não afetar os índices
    const sortedLocations = locations.sort((a, b) => b.lineIndex - a.lineIndex);
    
    sortedLocations.forEach(location => {
      if (location.lineIndex < lines.length) {
        const originalLine = lines[location.lineIndex];
        
        if (location.type === 'underline') {
          // Para linhas de sublinhado, inserir assinatura acima
          lines[location.lineIndex] = '[ASSINATURA_ACIMA_LINHA]\n' + originalLine;
        } else if (location.type === 'text') {
          // Para texto "ASSINATURA", inserir acima do texto
          lines[location.lineIndex] = '[ASSINATURA_ACIMA_TEXTO]\n' + originalLine;
        }
      }
    });
    
    return {
      processedText: lines.join('\n'),
      detectedLocations: locations,
      summary: {
        totalLocations: locations.length,
        averageConfidence: locations.reduce((sum, loc) => sum + loc.confidence, 0) / locations.length,
        highConfidenceCount: locations.filter(loc => loc.confidence >= 0.8).length,
        underlineCount: locations.filter(loc => loc.type === 'underline').length,
        textCount: locations.filter(loc => loc.type === 'text').length
      }
    };
  }
}

module.exports = SignatureDetector;