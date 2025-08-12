
UPDATE knowledge_base 
SET content = 'Protocolo para identificação e manejo eficiente de Fato Específico

O QUE É UM FATO ESPECÍFICO
- É um evento/situação concreta do passado (um “vídeo mental”), que gerou emoções intensas ou negativas.

REGRAS IMPORTANTES PARA AS SUGESTÕES
- As 3 sugestões DEVEM conter SOMENTE o fato, com variações sutis de redação.
- NUNCA incluir emoções nas sugestões (ex.: “me senti…”, “fiquei…”). Emoções só serão trabalhadas depois.
- Usar SEMPRE botões no formato exato, numa única linha, sem aspas e sem numeração:
  [BTN:fato1:Variação 1 do fato] [BTN:fato2:Variação 2 do fato] [BTN:fato3:Variação 3 do fato]
- Logo abaixo, apresentar as opções de autocura, também como botões:
  [BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]

RESPOSTA PADRÃO AO DETECTAR UM FATO ESPECÍFICO
1) Reconhecimento breve e empático da situação.
2) Em seguida, apresente EXATAMENTE duas linhas de botões:
   Linha 1: 3 sugestões APENAS DO FATO (sem sentimentos)
   Linha 2: opções de autocura (agora/depois)
3) Não use listas numeradas nem aspas dentro dos botões. Seja direto.

EXEMPLOS DE SUGESTÕES (APENAS FATO)
Para "bati meu carro ontem":
[BTN:fato1:Ontem bati meu carro.] [BTN:fato2:O acidente com o carro ontem.] [BTN:fato3:A batida de carro de ontem à noite.]
[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]

Para "fui injustiçado no trabalho":
[BTN:fato1:Quando fui injustiçado no trabalho.] [BTN:fato2:A injustiça que sofri no trabalho.] [BTN:fato3:O episódio de injustiça no meu trabalho.]
[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]

Para "sofri bullying na escola":
[BTN:fato1:Quando sofri bullying na escola.] [BTN:fato2:As ofensas que recebi na escola.] [BTN:fato3:O bullying que vivi na escola.]
[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]

Para "perdi um ente querido":
[BTN:fato1:Quando perdi um ente querido.] [BTN:fato2:A perda do meu ente querido.] [BTN:fato3:O falecimento do meu ente querido.]
[BTN:autocura_agora:Trabalhar sentimentos agora] [BTN:autocura_depois:Autocurar depois]

FLUXO DEPOIS DA ESCOLHA
- Se o usuário clicar em "autocura_agora": antes de abrir o popup, orientar com as 3 perguntas:
  • O que você sentiu na hora ou no dia?
  • O que você continuou sentindo depois?
  • O que você recebeu desse fato (como te afetou a longo prazo)?
  Em seguida, abrir [POPUP:sentimentos].
- Se "autocura_depois": registrar o fato para trabalhar futuramente e seguir o atendimento normalmente.

OBSERVAÇÕES FINAIS
- Evite introduções longas. Seja objetivo e mantenha o foco no protocolo.
- Nunca misturar sentimentos nas sugestões do fato. Eles só entram na etapa do popup.'
WHERE title = 'Fato Específico – Diretrizes' AND is_active = true;
