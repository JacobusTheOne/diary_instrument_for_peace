/*
 * Listas de referência das abas Emoções e Crenças: palavras para ajudar a nomear
 * B (emoções perturbadoras específicas) e D (a crença na falta) na folha de exercício.
 */
(function (root) {
  'use strict';

  const emotions = {
    title: 'Emoções comuns',
    intro: 'Nomear o sentimento com precisão ajuda a preencher o campo B, "Eu sinto". "Eu nunca estou transtornado pela razão que penso." (Um Curso em Milagres, Lição 5)',
    style: 'chips',
    groups: [
      { name: 'Raiva', items: ['com raiva', 'irritado(a)', 'incomodado(a)', 'frustrado(a)', 'ressentido(a)', 'amargo(a)', 'furioso(a)', 'impaciente', 'indignado(a)', 'com ciúme', 'com inveja', 'com nojo'] },
      { name: 'Medo', items: ['com medo', 'ansioso(a)', 'preocupado(a)', 'nervoso(a)', 'inseguro(a)', 'em pânico', 'sobrecarregado(a)', 'ameaçado(a)', 'inquieto(a)', 'tenso(a)', 'apreensivo(a)', 'desconfiado(a)'] },
      { name: 'Tristeza', items: ['triste', 'magoado(a)', 'sozinho(a)', 'decepcionado(a)', 'de luto', 'sem esperança', 'desanimado(a)', 'rejeitado(a)', 'abandonado(a)', 'vazio(a)', 'pesado(a)', 'deprimido(a)'] },
      { name: 'Culpa e vergonha', items: ['culpado(a)', 'envergonhado(a)', 'constrangido(a)', 'humilhado(a)', 'indigno(a)', 'arrependido(a)', 'tolo(a)', 'exposto(a)', 'inadequado(a)', 'autocrítico(a)'] },
      { name: 'Sentir-se impotente', items: ['impotente', 'preso(a)', 'travado(a)', 'confuso(a)', 'invisível', 'desvalorizado(a)', 'incompreendido(a)', 'julgado(a)', 'traído(a)', 'usado(a)', 'controlado(a)', 'esgotado(a)'] },
    ],
  };

  const beliefs = {
    title: 'Crenças comuns na falta',
    intro: 'O campo D pede a crença por trás do transtorno, que toma a forma de uma imagem de mim mesmo(a), do outro ou do mundo. Se alguma destas soar verdadeira, escreva-a com as suas próprias palavras.',
    style: 'list',
    groups: [
      { name: 'Sobre mim', items: [
        'Não sou bom (boa) o suficiente.',
        'Não sou digno(a) de amor do jeito que sou.',
        'Preciso conquistar amor e aprovação.',
        'Estou sozinho(a).',
        'Não tenho poder para mudar o que sinto.',
        'Sou um fracasso.',
        'Eu não importo; sou invisível.',
        'Fiz algo errado e mereço ser punido(a).',
        'Não mereço ser feliz.',
        'Sou um corpo que pode ser ferido.',
        'Não posso confiar em mim mesmo(a).',
      ] },
      { name: 'Sobre os outros', items: [
        'Não dá para confiar nas pessoas.',
        'Os outros vão me deixar.',
        'Os outros não se importam comigo.',
        'As pessoas estão me julgando.',
        'Outra pessoa é responsável pelo que eu sinto.',
        'Os outros têm o que me falta.',
        'Eles precisam mudar para que eu fique em paz.',
        'Os outros podem tirar a minha paz.',
      ] },
      { name: 'Sobre o mundo e a vida', items: [
        'O mundo não é seguro.',
        'Não há o suficiente: tempo, dinheiro, amor.',
        'A vida é injusta.',
        'Preciso ter controle para estar seguro(a).',
        'Vou ser feliz quando algo mudar.',
        'O passado determina o meu presente.',
        'Tenho que fazer tudo sozinho(a).',
        'O sofrimento é o preço de estar aqui.',
        'Estou separado(a) de Deus.',
      ] },
    ],
  };

  root.Lists = { emotions, beliefs };
})(window);
