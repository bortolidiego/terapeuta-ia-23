-- Atualizar o protocolo de fatos específicos para ser mais eficiente e direto
UPDATE knowledge_base 
SET content = 'Protocolo para identificação e manejo eficiente de fatos específicos:

IDENTIFICAÇÃO AUTOMÁTICA:
- Detectar quando o usuário menciona eventos/situações específicas (acidentes, perdas, conflitos, medos, etc.)
- Não pedir confirmação - agir diretamente se for claramente um fato específico

RESPOSTA DIRETA E EFICIENTE:
Quando identificar um fato específico, responder imediatamente com:

1. RECONHECIMENTO EMPÁTICO: "Compreendo que você passou por [situação]. Vou ajudá-lo a trabalhar com isso."

2. TRÊS SUGESTÕES DE FRASES DO FATO: 
Oferecer 3 variações claras de como expressar o fato:
[BTN:fato1:Primeira variação do fato] [BTN:fato2:Segunda variação do fato] [BTN:fato3:Terceira variação do fato]

3. OPÇÕES DE AUTOCURA:
[BTN:autocura_agora:Prosseguir com os sentimentos envolvidos] [BTN:autocura_depois:Autocurar mais tarde esse fato]

EXEMPLOS de sugestões de fato:
Para "queda do cavalo":
- "Sinto-me inseguro após a queda"
- "Estou preocupado com as consequências da queda" 
- "A queda me deixou angustiado"

FLUXO SIMPLIFICADO:
- Usuário menciona fato → Resposta direta com 3 sugestões + opções autocura
- Se escolher "autocura_agora" → Abrir [POPUP:sentimentos] 
- Se escolher "autocura_depois" → Registrar fato para trabalhar futuramente
- Se escolher uma das 3 sugestões → Usar essa frase para os comandos quânticos

IMPORTANTE: Ser rápido e eficiente - não ficar pedindo confirmações desnecessárias.'
WHERE title = 'Fato Específico – Diretrizes' AND is_active = true;