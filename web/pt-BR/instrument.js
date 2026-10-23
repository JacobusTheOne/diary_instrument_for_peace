/*
 * O Instrumento para a Paz, de David Hoffmeister (Living Miracles), em português do Brasil.
 * Traduzido do original em inglês: https://livingmiraclescenter.org/doc/instrument-for-peace.pdf
 * (não encontramos uma versão oficial em português). "Upset" segue a lição 5 de
 * Um Curso em Milagres: "transtornado(a)" / "transtorno".
 *
 * {A} {B} {C1} {C2} {D} {E} são as respostas da página Níveis da Mente. Aparecem em
 * vermelho em cada passo e podem ser ajustadas no lugar, como no formulário original.
 * Uma linha que começa com "!" é destacada; uma linha que é só um campo vira um bloco.
 */
(function (root) {
  'use strict';

  const fields = {
    A: { label: 'Quando penso em', hint: 'Ação, situação ou acontecimento, passado ou futuro, que está causando o transtorno', level: 'perception' },
    B: { label: 'Eu sinto', hint: 'Emoções perturbadoras específicas', level: 'emotion' },
    C1: { label: 'Porque eu penso que … tem a culpa', hint: 'Nome (opcional)', level: 'thought', optional: true },
    C2: { label: 'e/ou porque tenho medo de que … aconteça no futuro', hint: 'O que vai acontecer (opcional)', level: 'thought', optional: true },
    D: { label: 'Esses pensamentos e sentimentos provam que estou certo(a) de que', hint: 'Minha crença na falta, na forma de uma imagem de mim mesmo(a)/do outro/do mundo', level: 'belief' },
    E: { label: 'O que eu quero (queria) e espero (esperava) é', hint: 'Ação, situação ou acontecimento desejado', level: 'desire' },
  };

  const intro =
    'A mente em paz está curada. A mente em paz acolheu a paz de todo o coração. Neste mundo, ' +
    'a falta de paz aparece de muitas formas. Para que a cura permanente aconteça, a falta de paz precisa ser rastreada ' +
    'até a sua causa única na mente. Usar este instrumento para esse rastreamento pode ajudar uma mente disposta ' +
    'a abrir mão do que pensa que sabe, ver o mundo de modo diferente e experimentar um estado presente de paz e alegria.';

  const levels = {
    quote: '"A verdade é restaurada a ti através do teu desejo, assim como foi perdida para ti através do teu desejo de outra coisa." — Um Curso em Milagres T-20.VIII.1.2',
    desire: 'O desejo de que algo seja diferente do que é agora está mantendo você longe da paz de Deus.',
    question: 'Você está disposto(a) a oferecer este desejo ao Espírito Santo agora, para se realinhar com o único objetivo que lhe trará o que você verdadeiramente quer? A aceitar a paz de espírito agora?',
    resistance: 'Se você sentir qualquer resistência a escolher a paz de Deus usando o Diagrama dos Níveis da Mente, continue com o Instrumento para a Paz. Sinta-se à vontade para ajustar suas respostas a qualquer momento, alterando o texto em vermelho.',
  };

  const steps = [
    [
      'Quando penso na ação, situação ou acontecimento que me transtorna:',
      '{A}',
      'Eu sinto:',
      '{B}',
      'Porque eu penso que:',
      '{C1} tem a culpa e/ou',
      'Porque tenho medo de que:',
      '{C2} no futuro.',
    ],
    [
      'Pensar em {A}',
      'Sentir {B}',
      'Culpar {C1} e/ou',
      'Temer {C2}',
      'Provam que estou certo(a) de que:',
      '{D}',
      'Não gosto de como me sinto agora, por isso estou pronto(a) para considerar a possibilidade de que a maneira como percebo isto não é a maneira como realmente é. Como parte do processo de cura, estou disposto(a) a olhar além da minha percepção deste transtorno (o significado que dei a ele) e olhar para dentro da minha mente.',
    ],
    [
      'Quero aprender que existe uma maneira de, sem culpa, ver o papel que desempenho em:',
      'Pensar em {A}',
      'Sentir {B}',
      'Culpar {C1} e/ou',
      'Temer {C2}',
    ],
    [
      'Abro mão do meu desejo de estar certo(a) sobre a minha percepção de tudo isso em:',
      'Pensar em {A}',
      'Sentir {B}',
      'Culpar {C1} e/ou',
      'Temer {C2}',
      'E provar que {D}',
      'Em vez disso, quero ser feliz. Através do ego (pensamento/visão distorcidos), percebo a causa do meu transtorno e a sua solução como fora da minha mente. Essa projeção parece muito real; o seu propósito é distrair a minha mente de olhar para dentro.',
    ],
    [
      'Se a causa do meu transtorno e a sua solução estivessem fora da minha mente, eu seria, de fato, impotente para mudar o meu estado mental. O meu uso da projeção (ver fora o que não quero ver dentro) é a razão pela qual pareço impotente, a razão pela qual:',
      '{C1} e/ou',
      'Temer {C2}',
      'parece(m) ser a causa do meu transtorno.',
    ],
    [
      'Pensar em {A}',
      'Sentir {B}',
      'Culpar {C1} e/ou',
      'Temer {C2}',
      'Resultam da minha crença de que:',
      '{D}',
    ],
    [
      'Só fico transtornado(a) com alguém ou com algo quando essa pessoa ou coisa reflete de volta para a minha mente uma crença que neguei à consciência. Quando culpo/temo algo no mundo, é para evitar ver o transtorno e a solução como realmente são (uma decisão na minha mente) e, em vez disso, manter uma imagem de mim mesmo(a)/do outro/do mundo do jeito que desejo. Esse truque da mente parece deslocar a culpa e o medo, mas na verdade mantém os sentimentos de transtorno. Culpar ou temer uma imagem de mim mesmo(a)/do outro/do mundo exige que eu acredite que estou limitado(a) a um corpo e a um mundo de corpos, e nega a realidade espiritual abstrata do meu ser. Como primeiro passo para soltar todo transtorno, quero ver na minha mente o que eu pensava estar fora dela.',
      'Ficar transtornado(a) com: {A}',
      'é apenas mais uma tentativa de fazer de:',
      '{C1} e/ou',
      'do pensamento futuro:',
      '{C2} a causa da minha culpa e do meu medo.',
    ],
    [
      'O transtorno parece valioso e justificável quando:',
      '{A}',
      'vai contra o que eu quero.',
      'O que eu quero (queria) e espero (esperava) é:',
      '{E}',
      'Ainda acredito que:',
      '{D}',
      'por isso penso que preciso de:',
      '{E}',
      'para ser feliz, completo(a) e estar em paz.',
      '!Essa crença na falta e a expectativa que resulta dela são mais importantes para mim do que a paz de espírito?',
    ],
    [
      'Tudo no mundo coopera para o meu bem. O que penso ser a causa do meu transtorno não é a causa de forma alguma. A escolha de ficar transtornado(a) é uma escolha de não ver a causa — a minha crença na separação/falta — como uma decisão presente na minha mente. É uma tentativa de ver a causa no passado/futuro e o presente como o seu efeito.',
    ],
    [
      '!O que eu quero AGORA MESMO, acima de tudo, é paz.',
      'Por isso, questiono a crença de que:',
      '{D}',
      'e abro mão voluntariamente do desejo de:',
      '{E}',
      'para me reconectar com o meu único objetivo: a paz.',
    ],
    [
      '!A paz de espírito é uma decisão presente que escolho com gratidão AGORA MESMO!',
      'A culpa e o medo das consequências só pareciam possíveis porque eu estava determinado(a) a me agarrar a uma crença numa causa passada/futura. Solto o significado que dei ao passado/futuro e abro a minha mente para o presente, absolvido(a) e inocente.',
    ],
    [
      'Sou grato(a) pela compreensão de que a causa do meu transtorno, que eu pensava estar no mundo, era na verdade apenas uma crença e uma decisão não questionadas na minha mente; decidi de novo pela minha PAZ DE ESPÍRITO.',
    ],
  ];

  const closing = 'Escreva abaixo os insights que surgiram no processo. Faça quantas folhas de exercício forem necessárias para experimentar a paz presente, se esse for o seu desejo.';

  const source = {
    title: 'Instrumento para a Paz — David Hoffmeister',
    url: 'https://livingmiraclescenter.org/doc/instrument-for-peace.pdf',
    home: 'https://livingmiracles.org',
  };

  root.Instrument = { fields, intro, levels, steps, closing, source };
})(window);
