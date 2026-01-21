const SignatureDetector = require('./services/signatureDetector');
const fs = require('fs');
const path = require('path');

// Teste das novas funcionalidades de detecção
async function testEnhancedDetection() {
  console.log('🔍 TESTE DAS NOVAS IMPLEMENTAÇÕES DE DETECÇÃO\n');
  
  const detector = new SignatureDetector();
  
  // Simular diferentes tipos de documentos
  const testCases = [
    {
      name: 'Documento com linha de sublinhado',
      content: `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Este contrato é firmado entre as partes:

CONTRATANTE: João Silva
CONTRATADO: Maria Santos

Cláusula 1: Objeto do contrato...
Cláusula 2: Valor e forma de pagamento...

_____________________________
João Silva - Contratante

_____________________________
Maria Santos - Contratada

Data: ___/___/______
      `
    },
    {
      name: 'Documento com texto ASSINATURA',
      content: `
TERMO DE COMPROMISSO

Eu, João Silva, comprometo-me a cumprir todas as obrigações.

ASSINATURA DO CONTRATANTE

ASSINATURA DO CONTRATADO

Local e Data: São Paulo, 15 de dezembro de 2024
      `
    },
    {
      name: 'Documento misto (linha + texto)',
      content: `
ACORDO COMERCIAL

Partes envolvidas:
- Empresa ABC LTDA
- Fornecedor XYZ S.A.

Termos do acordo...

_____________________________
Representante da Empresa ABC LTDA

ASSINATURA DO FORNECEDOR

_____________________________
Testemunha 1

_____________________________
Testemunha 2
      `
    },
    {
      name: 'Documento sem assinaturas válidas',
      content: `
RELATÓRIO MENSAL

Este é um relatório de atividades do mês de dezembro.

Atividades realizadas:
- Reunião com cliente
- Desenvolvimento de projeto
- Testes de qualidade

Observações:
- Todas as metas foram atingidas
- Próximas etapas definidas

Fim do relatório.
      `
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📄 TESTANDO: ${testCase.name}`);
    console.log('=' .repeat(50));
    
    try {
      // Analisar o texto diretamente
      const locations = detector.analyzeTextForSignatures(testCase.content);
      
      if (locations.length === 0) {
        console.log('❌ Nenhuma assinatura detectada\n');
        continue;
      }
      
      console.log(`✅ ${locations.length} assinatura(s) detectada(s):\n`);
      
      locations.forEach((location, index) => {
        const typeIcon = location.type === 'underline' ? '📏' : '📝';
        const typeText = location.type === 'underline' ? 'Linha de Sublinhado' : 'Texto "ASSINATURA"';
        
        console.log(`${typeIcon} Assinatura ${index + 1} - ${typeText}`);
        console.log(`   Linha: ${location.lineIndex + 1}`);
        console.log(`   Conteúdo: "${location.lineParagraph}"`);
        console.log(`   Confiança: ${(location.confidence * 100).toFixed(1)}%`);
        
        if (location.type === 'underline' && location.nameParagraph !== location.lineParagraph) {
          console.log(`   Nome: "${location.nameParagraph}"`);
        }
        
        if (location.context.before.length > 0) {
          console.log(`   Contexto anterior: ${location.context.before.slice(0, 2).join(' | ')}`);
        }
        
        if (location.context.after.length > 0) {
          console.log(`   Contexto posterior: ${location.context.after.slice(0, 2).join(' | ')}`);
        }
        
        console.log('');
      });
      
      // Estatísticas
      const underlineCount = locations.filter(loc => loc.type === 'underline').length;
      const textCount = locations.filter(loc => loc.type === 'text').length;
      const avgConfidence = locations.reduce((sum, loc) => sum + loc.confidence, 0) / locations.length;
      
      console.log(`📊 ESTATÍSTICAS:`);
      console.log(`   Total: ${locations.length}`);
      console.log(`   Linhas: ${underlineCount}`);
      console.log(`   Textos: ${textCount}`);
      console.log(`   Confiança média: ${(avgConfidence * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
  
  // Teste de hierarquia de prioridade
  console.log('🎯 TESTE DE HIERARQUIA DE PRIORIDADE\n');
  
  const mixedContent = `
CONTRATO ESPECIAL

ASSINATURA DO CLIENTE
_____________________________
João Silva

ASSINATURA DO FORNECEDOR  
_____________________________
Maria Santos LTDA
  `;
  
  console.log('📄 Documento com texto e linha próximos:');
  const mixedLocations = detector.analyzeTextForSignatures(mixedContent);
  
  console.log(`✅ Detectadas ${mixedLocations.length} assinatura(s):`);
  mixedLocations.forEach((loc, i) => {
    const priority = loc.type === 'underline' ? '🥇 PRIORIDADE ALTA' : '🥈 PRIORIDADE BAIXA';
    console.log(`   ${i + 1}. ${priority} - ${loc.type} (${(loc.confidence * 100).toFixed(1)}%)`);
  });
  
  console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
}

// Executar teste
if (require.main === module) {
  testEnhancedDetection().catch(console.error);
}

module.exports = { testEnhancedDetection };