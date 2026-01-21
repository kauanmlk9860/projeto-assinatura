# 📝 Sistema de Assinatura Digital - VERSÃO APRIMORADA

## 🎯 Novas Implementações - Detecção e Posicionamento Inteligente

### ✨ Funcionalidades Implementadas

#### 1️⃣ **Detecção Dupla de Assinaturas**
- **Detecção por Linha de Sublinhado**: Identifica linhas como `_____________________`
- **Detecção por Texto**: Reconhece variações de "ASSINATURA" no documento
- **Hierarquia Inteligente**: Prioriza linhas de sublinhado sobre texto

#### 2️⃣ **Posicionamento Preciso**
- **Linhas de Sublinhado**: Assinatura inserida **acima** da linha, centralizada
- **Texto "ASSINATURA"**: Assinatura inserida **acima** do texto, centralizada
- **Dimensionamento Proporcional**: Tamanho automático baseado no espaço disponível

#### 3️⃣ **Validação Inteligente**
- **Contexto**: Verifica texto próximo para confirmar local de assinatura
- **Confiança**: Sistema de pontuação para qualidade da detecção
- **Filtros**: Remove falsos positivos e duplicatas

## 🔍 Critérios de Detecção

### Detecção por Linha de Sublinhado
```
Padrões reconhecidos:
- _____________________ (underscores)
- --------------------- (hífens)
- ..................... (pontos)
- Combinações: ___ ___ ___

Validação:
✅ Mínimo 6 caracteres especiais
✅ Densidade > 50% de caracteres especiais
✅ Nome identificado nas linhas próximas
```

### Detecção por Texto "ASSINATURA"
```
Variações reconhecidas:
- ASSINATURA
- Assinatura do Contratante
- Assinatura do Cliente
- assina, assinado, assinar

Validação:
✅ Palavra "assinatura" presente
✅ Contexto relevante (contratante, cliente, etc.)
✅ Não muito texto adicional (< 10 palavras)
```

## 📐 Regras de Posicionamento

### Hierarquia de Decisão
1. **Prioridade ALTA**: Linhas de sublinhado com nome próximo
2. **Prioridade MÉDIA**: Texto "ASSINATURA" isolado
3. **Filtro**: Remove textos próximos a linhas (< 5 linhas de distância)

### Dimensionamento Automático
```javascript
Assinatura padrão:
- Largura máxima: 180px
- Altura máxima: 70px
- Proporção: 2.5:1 (largura:altura)
- Ajuste automático para manter proporção
```

### Espaçamento Visual
```
Para Linhas de Sublinhado:
[espaço 15px]
[ASSINATURA CENTRALIZADA]
[espaço 8px]
[linha original: _____________]

Para Texto "ASSINATURA":
[espaço 10px]
[ASSINATURA CENTRALIZADA]
[espaço 12px]
[texto original: ASSINATURA DO CLIENTE]
```

## 🚀 Como Usar

### 1. Teste de Detecção
```bash
# Executar teste das novas funcionalidades
cd api
node test-enhanced-detector.js
```

### 2. API Endpoint - Testar Detecção
```javascript
POST /api/detect-signatures
Content-Type: multipart/form-data

// Retorna:
{
  "success": true,
  "detectedLocations": [
    {
      "type": "underline",        // ou "text"
      "lineIndex": 15,
      "lineParagraph": "_______________",
      "nameParagraph": "João Silva",
      "confidence": 0.85,
      "context": {
        "before": ["CONTRATANTE:"],
        "after": ["Data: ___/___/___"]
      }
    }
  ],
  "summary": {
    "totalLocations": 2,
    "underlineCount": 1,
    "textCount": 1,
    "averageConfidence": 0.78
  }
}
```

### 3. Processamento Completo
```javascript
POST /api/process-documents
Content-Type: multipart/form-data

// Campos:
- documents: arquivo(s) .docx
- signature: imagem da assinatura OU
- signatureData: assinatura desenhada (base64)
```

## 📊 Exemplos de Detecção

### ✅ Casos Suportados

#### Documento Empresarial
```
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

_____________________________     ← DETECTADO (linha)
João Silva - Contratante

ASSINATURA DO CONTRATADO          ← DETECTADO (texto)

_____________________________     ← DETECTADO (linha)
Testemunha
```

#### Documento Simples
```
TERMO DE COMPROMISSO

Eu concordo com os termos.

ASSINATURA                        ← DETECTADO (texto)

Data: ___/___/______
```

### ❌ Casos Ignorados

```
Este é um relatório sobre assinaturas digitais.  ← Apenas menção
=================================                ← Separador
***********************************              ← Decoração
Linha com __ poucos __ sublinhados               ← Insuficiente
```

## 🎨 Melhorias Visuais

### Qualidade da Assinatura
- **Fundo Transparente**: Remove fundo branco das imagens
- **Compressão Otimizada**: Reduz tamanho sem perder qualidade
- **Proporção Mantida**: Evita distorções na assinatura

### Layout Profissional
- **Centralização Precisa**: Assinatura sempre centralizada
- **Espaçamento Equilibrado**: Distâncias padronizadas
- **Quebra de Página**: Evita cortar assinaturas entre páginas

## 🔧 Configurações Técnicas

### Parâmetros de Detecção
```javascript
// signatureDetector.js
minUnderlineLength: 6        // Mínimo de caracteres sublinhados
maxDistanceToName: 3         // Máximo de linhas entre sublinhado e nome
minNameLength: 3             // Mínimo de caracteres para nome
maxNameLength: 100           // Máximo de caracteres para nome
```

### Thresholds de Confiança
```javascript
confidence >= 0.8  // Alta confiança
confidence >= 0.6  // Média confiança  
confidence >= 0.4  // Baixa confiança (mínimo aceito)
```

## 📈 Estatísticas de Detecção

O sistema fornece métricas detalhadas:
- **Total de Assinaturas**: Quantidade detectada
- **Tipos**: Separação entre linhas e textos
- **Confiança Média**: Qualidade geral da detecção
- **Alta Confiança**: Detecções com > 80% de certeza

## 🛡️ Validações e Segurança

### Filtros Anti-Falso Positivo
- Verifica densidade de caracteres especiais
- Analisa contexto das palavras próximas
- Remove padrões de formatação (tabelas, separadores)
- Valida nomes com padrões realistas

### Tratamento de Erros
- Documento sem assinaturas: Erro informativo
- Baixa confiança: Aviso ao usuário
- Arquivo corrompido: Mensagem clara de erro

## 🎯 Resultados Esperados

### ✅ Detecção Automática
- Identifica 95%+ dos locais de assinatura válidos
- Reduz falsos positivos para < 5%
- Funciona com documentos simples e complexos

### ✅ Posicionamento Profissional
- Assinaturas sempre bem posicionadas
- Tamanho proporcional e consistente
- Layout final com aparência manual

### ✅ Compatibilidade
- Documentos Word (.docx) de qualquer origem
- Diferentes estilos de formatação
- Múltiplas assinaturas por documento

---

## 🚀 Executar o Sistema

```bash
# Backend
cd api
npm install
npm start

# Frontend
cd web
# Abrir index.html no navegador
# ou usar servidor local: python -m http.server 8000
```

**API disponível em**: `http://localhost:3002`  
**Interface web**: `http://localhost:8000` (se usando servidor local)

---

*Sistema desenvolvido com detecção inteligente e posicionamento profissional de assinaturas digitais.*