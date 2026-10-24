/*
 * O Formulário Julgue Seu Próximo, do The Work of Byron Katie®, e os rótulos da versão
 * guiada. Texto do formulário oficial em português:
 * https://thework.com/wp-content/uploads/2019/12/jyn_pt_26nov2019_a4_form.pdf
 * (© 2019 Byron Katie International, Inc.). As perguntas de apoio da pergunta 3 e os
 * rótulos da interface são tradução não oficial de https://thework.com/instruction-the-work-byron-katie/
 *
 * O `frame` de cada declaração monta a frase que será investigada:
 * {name} é a pessoa, {emotion} o sentimento (declaração 1), {text} o restante.
 */
(function (root) {
  'use strict';

  const statements = [
    {
      n: 1,
      question: 'Nessa situação, quem lhe causa raiva, confunde, fere, entristece ou desaponta você e por quê?',
      example: 'Eu estou com raiva do Paul porque ele mentiu para mim.',
      frame: ['Estou ', '{emotion}', ' de ', '{name}', ' porque ', '{text}'],
      hint: 'ele/ela…',
    },
    {
      n: 2,
      question: 'Nessa situação, como você quer que a pessoa mude? O que você quer que ela faça?',
      example: 'Eu quero que o Paul veja que ele está errado. Eu quero que ele pare de mentir para mim.',
      frame: ['Eu quero que ', '{name}', ' ', '{text}'],
      hint: 'veja que…, pare de…',
    },
    {
      n: 3,
      question: 'Nessa situação, que conselho você ofereceria à pessoa? “Ele/ela deveria/não deveria…”',
      example: 'Paul não deveria me assustar com o comportamento dele. Ele deveria respirar fundo.',
      frame: ['{name}', ' ', '{text}'],
      hint: 'deveria / não deveria…',
    },
    {
      n: 4,
      question: 'Para você ser feliz nessa situação, o que você precisa que a pessoa pense, diga, sinta ou faça?',
      example: 'Eu preciso que o Paul pare de me interromper. Eu preciso que ele realmente me escute.',
      frame: ['Eu preciso que ', '{name}', ' ', '{text}'],
      hint: 'pare de…, realmente me escute…',
    },
    {
      n: 5,
      question: 'O que você pensa sobre a pessoa nessa situação? Faça uma lista. (Tudo bem você ser mesquinho e julgar.)',
      example: 'Paul é mentiroso, arrogante, barulhento, desonesto e inconsciente.',
      frame: ['{name}', ' é ', '{text}'],
      hint: 'mentiroso, arrogante, barulhento…',
    },
    {
      n: 6,
      question: 'O que, sobre essa pessoa e situação, você não quer nunca mais voltar a experienciar?',
      example: 'Eu não quero nunca mais que Paul minta para mim. Eu não quero ser desrespeitada outra vez.',
      frame: ['Eu não quero nunca mais que ', '{text}'],
      hint: '… minta para mim',
    },
  ];

  const questions = [
    { title: 'Isso é verdade?', note: '(Sim ou não. Se não, vá para a pergunta 3.)' },
    { title: 'Você pode saber com certeza absoluta que isso é verdade?', note: '(Sim ou não.)' },
    {
      title: 'Como você reage, o que acontece, quando você acredita nesse pensamento?',
      prompts: [
        'Que imagens você vê, do passado ou do futuro, e que emoções ou sensações físicas surgem enquanto você observa essas imagens?',
        'Como você tratou a outra pessoa?',
        'Como você tratou a si mesmo(a)?',
        'Alguma obsessão ou vício começa a aparecer quando você acredita nesse pensamento?',
      ],
    },
    { title: 'Quem ou o que você seria sem o pensamento?', note: 'Como você veria a outra pessoa, ou o que sentiria por ela?' },
  ];

  const turnaround = {
    title: 'Faça a inversão.',
    intro: 'À medida que você visualiza a situação, contemple como cada inversão é tão verdade ou mais verdade. Encontre três exemplos de como cada inversão é tão verdadeira quanto a declaração original, ou mais.',
    example: 'Exemplo: “Paulo mentiu para mim.” → Eu menti para mim. · Eu menti para o Paul. · O Paul não mentiu para mim. · Paul me disse a verdade.',
    kinds: [
      { label: 'Para si mesmo(a)', placeholder: 'ex.: Eu menti para mim.' },
      { label: 'Para o outro', placeholder: 'ex.: Eu menti para o Paul.' },
      { label: 'Para o oposto', placeholder: 'ex.: O Paul não mentiu para mim.' },
    ],
    // Declaração 6: substitua “Eu não quero nunca mais que…” por “Eu estou disposto a que…” e “Eu não vejo a hora que…”
    s6prefix: /^Eu não quero nunca mais que\s+/i,
    s6: [
      { label: 'Eu estou disposto(a) a que…', make: (rest) => `Eu estou disposto(a) a que ${rest}` },
      { label: 'Eu não vejo a hora que…', make: (rest) => `Eu não vejo a hora que ${rest}` },
    ],
    s6note: 'Ajuste as palavras para que a frase soe natural.',
  };

  const ui = {
    title: 'Formulário de Byron Katie',
    intro: 'O Formulário Julgue Seu Próximo, do The Work de Byron Katie. Pense numa situação estressante com alguém — por exemplo, uma discussão. À medida que você medita sobre aquele momento e lugar específicos, escreva os seus julgamentos e depois investigue cada um com as quatro perguntas e faça a inversão.',
    how: [
      ['Descreva', ' a situação estressante e com quem ela aconteceu.'],
      ['Escreva', ' as seis declarações em frases curtas e simples. Tudo bem ser mesquinho e julgar.'],
      ['Investigue', ' cada declaração com as quatro perguntas.'],
      ['Faça a inversão', ' e encontre exemplos de como cada inversão é tão verdade ou mais verdade que a original.'],
    ],
    start: 'Começar um formulário',
    startSelected: 'Começar com o texto selecionado',
    untitled: 'Novo formulário',
    progress: (done, total) => `${done}/${total} investigadas`,
    deleteWs: 'Excluir formulário',
    deleteTitle: 'Excluir este formulário?',
    deleteMsg: (title) => `“${title}” e suas respostas serão removidos do caderno.`,
    cancel: 'Cancelar',
    del: 'Excluir',
    back: '← Voltar',
    next: 'Próximo →',
    stage: (n) => `${n} / 3`,

    situationTitle: 'A situação',
    situationText: 'Pense numa situação estressante com alguém — por exemplo, uma discussão. Medite sobre aquele momento e lugar específicos.',
    nameLabel: 'Com quem?',
    namePlaceholder: 'Nome',
    situationLabel: 'O que aconteceu?',
    situationPlaceholder: 'Um momento e lugar específicos…',
    useSelected: 'Usar texto selecionado',
    useEntry: 'Usar a entrada atual',
    selectFirst: 'Selecione um texto na aba Diário primeiro',
    toStatements: 'Escrever as declarações →',
    someone: 'a pessoa',

    statementsTitle: 'As seis declarações',
    statementOf: (n) => `Declaração ${n} de 6`,
    exampleLabel: 'Exemplo: ',
    emotionPlaceholder: 'emoção',
    toBeliefs: 'Investigar as declarações →',
    preview: 'Será investigada como: ',

    beliefsTitle: 'Declarações para investigar',
    beliefsText: 'Cada cartão é uma declaração para investigar. Edite-as para que cada uma contenha um pensamento e desmarque as que você não quer investigar agora.',
    addBelief: '+ Adicionar uma declaração',
    remove: 'Remover',
    split: 'Dividir',
    splitHint: 'Coloque o cursor dentro da declaração, no ponto onde ela deve ser dividida.',
    include: 'Investigar esta declaração',
    begin: (n) => (n === 1 ? 'Investigar 1 declaração →' : `Investigar ${n} declarações →`),
    noBeliefs: 'Preencha pelo menos uma declaração primeiro.',
    fromStatement: (n) => `Declaração ${n}`,

    inquiryOf: (pos, total) => `3 / 3 · Declaração ${pos} de ${total}`,
    editBeliefs: 'Editar declarações',
    summary: 'Resumo',
    stepLabels: ['1', '2', '3', '4', 'Inversão'],
    stepTitles: ['Pergunta 1', 'Pergunta 2', 'Pergunta 3', 'Pergunta 4', 'Inversões'],
    yes: 'Sim',
    no: 'Não',
    q3Placeholder: 'Observe o que acontece quando você acredita nisso…',
    q4Placeholder: 'Sem o pensamento, eu seria…',
    turnText: 'Inversão',
    examplesLabel: 'Três exemplos',
    examplesPlaceholder: '1.\n2.\n3.',
    addTurn: '+ Adicionar uma inversão',
    complete: (last) => (last ? 'Concluir e ver o resumo ✓' : 'Concluir e ir à próxima ✓'),
    skip: 'Pular esta declaração por enquanto →',
    done: 'Declaração investigada',

    summaryTitle: 'Resumo',
    summaryDone: 'Formulário concluído',
    summaryProgress: (done, total) => `${done} de ${total} investigadas`,
    isTrue: 'Isso é verdade? ',
    absolutely: 'Pode saber com certeza absoluta? ',
    reaction: 'Quando acredito nisso: ',
    without: 'Sem o pensamento: ',
    turnarounds: 'Inversões: ',
    questioned: 'Investigada',
    notYet: 'Ainda não investigada',
    review: 'Revisar',
    work: 'Investigar',
    backStatements: '← Declarações',
    addToDiary: 'Adicionar resumo ao diário',
    backToDiary: 'Voltar ao diário',
    diaryHeading: 'Formulário de Byron Katie',
    with: 'Com: ',
    added: 'Resumo adicionado ao diário',
  };

  const source = {
    url: 'https://thework.com/portugues/',
  };

  root.Katie = { statements, questions, turnaround, ui, source };
})(window);
