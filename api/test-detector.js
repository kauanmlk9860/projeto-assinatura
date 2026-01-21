const SignatureDetector = require('./services/signatureDetector');
const path = require('path');

// Teste do detector com texto simulado
async function testDetector() {
  const detector = new SignatureDetector();
  
  // Simular texto de documento com diferentes padrões de assinatura
  const testTexts = [
    // Caso 1: Assinatura tradicional
    `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Este contrato é celebrado entre as partes:

CONTRATANTE: Empresa ABC Ltda.
CONTRATADO: João Silva

Cláusula 1: O contratado se compromete...
Cláusula 2: O pagamento será...

Local e Data: São Paulo, 15 de dezembro de 2024

_________________________________
João Silva
CPF: 123.456.789-00

_________________________________
Maria Santos
Representante Legal - Empresa ABC Ltda.`,

    // Caso 2: Múltiplas assinaturas
    `TERMO DE ACEITE

Eu, _________________________, declaro que aceito os termos.
    FULANO DE TAL

Testemunha 1: ____________________
              JOSÉ DA SILVA

Testemunha 2: ____________________
              ANA MARIA COSTA`,

    // Caso 3: Formato corporativo
    `DECLARAÇÃO

A empresa XYZ S.A. declara que...

Atenciosamente,


__________________________
DIRETOR PRESIDENTE
XYZ SOCIEDADE ANÔNIMA`
  ];

  console.log('🔍 TESTE DO DETECTOR DE ASSINATURAS\n');

  for (let i = 0; i < testTexts.length; i++) {
    console.log(`📄 TESTE ${i + 1}:`);
    console.log('─'.repeat(50));
    
    try {
      const locations = detector.analyzeTextForSignatures(testTexts[i]);
      
      if (locations.length > 0) {
        console.log(`✅ Encontradas ${locations.length} assinatura(s):`);
        
        locations.forEach((loc, index) => {
          console.log(`\n  ${index + 1}. Linha ${loc.lineIndex}:`);
          console.log(`     Sublinhado: "${loc.lineParagraph}"`);
          console.log(`     Nome: "${loc.nameParagraph}"`);
          console.log(`     Confiança: ${(loc.confidence * 100).toFixed(1)}%`);
          
          if (loc.context) {
            console.log(`     Contexto antes: ${loc.context.before.slice(0, 1).join(', ')}`);
            console.log(`     Contexto depois: ${loc.context.after.slice(0, 1).join(', ')}`);
          }
        });
      } else {
        console.log('❌ Nenhuma assinatura detectada');
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testDetector().catch(console.error);
}

module.exports = { testDetector };