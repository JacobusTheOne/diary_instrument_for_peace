/*
 * The Judge-Your-Neighbor Worksheet from The Work of Byron Katie®, plus the labels
 * for the guided version of it. Worksheet text from
 * https://thework.com/wp-content/uploads/2019/02/3-Judge-Your-Neighbor-Worksheet-v20250115-for-website.pdf
 * (©2025 Byron Katie International, Inc.); the question-3 prompts are from
 * https://thework.com/instruction-the-work-byron-katie/
 *
 * Each statement's `frame` builds the sentence that gets questioned:
 * {name} is the person, {emotion} the feeling (statement 1), {text} the rest.
 */
(function (root) {
  'use strict';

  const statements = [
    {
      n: 1,
      question: 'In this situation, who angers, confuses, hurts, saddens, or disappoints you, and why?',
      example: 'I am angry with Paul because he lied to me.',
      frame: ['I am ', '{emotion}', ' with ', '{name}', ' because ', '{text}'],
      hint: 'he/she/they…',
    },
    {
      n: 2,
      question: 'In this situation, how do you want him/her/them to change? What do you want him/her/them to say or do?',
      example: 'I want Paul to see that he is wrong. I want him to stop lying to me. I want him to apologize.',
      frame: ['I want ', '{name}', ' to ', '{text}'],
      hint: 'see that…, stop…, apologize…',
    },
    {
      n: 3,
      question: 'In this situation, what advice would you offer him/her/them? “He/she/they should/shouldn’t…”',
      example: 'Paul shouldn’t frighten me with his behavior. He should take a deep breath.',
      frame: ['{name}', ' ', '{text}'],
      hint: 'should / shouldn’t…',
    },
    {
      n: 4,
      question: 'In order for you to be happy in this situation, what do you need him/her/them to think, say, feel, or do?',
      example: 'I need Paul to stop talking over me. I need him to really listen to me.',
      frame: ['I need ', '{name}', ' to ', '{text}'],
      hint: 'stop…, really listen…',
    },
    {
      n: 5,
      question: 'What do you think of him/her/them in this situation? Make a list. (It’s okay to be petty and judgmental.)',
      example: 'Paul is a liar, arrogant, loud, dishonest, and unconscious.',
      frame: ['{name}', ' is ', '{text}'],
      hint: 'a liar, arrogant, loud…',
    },
    {
      n: 6,
      question: 'What is it about this person and situation that you don’t ever want to experience again?',
      example: 'I don’t ever want Paul to lie to me again. I don’t ever want to be disrespected again.',
      frame: ['I don’t ever want ', '{text}'],
      hint: '… to lie to me again',
    },
  ];

  const questions = [
    { title: 'Is it true?', note: '(Yes or no. If no, move to question 3.)' },
    { title: 'Can you absolutely know that it’s true?', note: '(Yes or no.)' },
    {
      title: 'How do you react, what happens, when you believe that thought?',
      prompts: [
        'What images do you see, past or future, and what emotions or physical sensations arise as you witness those images?',
        'How did you treat the other person?',
        'How did you treat yourself?',
        'Do any obsessions or addictions begin to appear when you believe that thought?',
      ],
    },
    { title: 'Who or what would you be without the thought?', note: 'How would you see or feel about the other person?' },
  ];

  // "lie" -> "lying", "stop" -> "stopping", "be" -> "being", "make" -> "making"
  function gerund(v) {
    if (/^(be|see|flee|agree)$/i.test(v)) return v + 'ing';
    if (/ie$/i.test(v)) return v.slice(0, -2) + 'ying';
    if (/[^e]e$/i.test(v)) return v.slice(0, -1) + 'ing';
    if (/^[^aeiou]*[aeiou][bcdfgklmnprstvz]$/i.test(v)) return v + v.slice(-1) + 'ing';
    return v + 'ing';
  }

  // "Paul to lie to me again" -> "I look forward to Paul lying to me again"
  function lookForward(rest) {
    const m = rest.match(/^(?:(.+?)\s+)?to\s+([a-z]+)(.*)$/i);
    if (!m) return `I look forward to ${rest}`;
    const [, who, verb, tail] = m;
    return `I look forward to ${who ? who + ' ' : ''}${gerund(verb)}${tail}`;
  }

  const turnaround = {
    title: 'Turn the thought around.',
    intro: 'Is the opposite as true as or truer than the original thought? Find three examples of how each turnaround is as true as, or truer than, your original statement.',
    example: 'Example: “Paul lied to me.” → I lied to me. · I lied to Paul. · Paul didn’t lie to me. · Paul told me the truth.',
    kinds: [
      { label: 'To the self', placeholder: 'e.g. I lied to me.' },
      { label: 'To the other', placeholder: 'e.g. I lied to Paul.' },
      { label: 'To the opposite', placeholder: 'e.g. Paul didn’t lie to me.' },
    ],
    // Statement 6: replace “I don’t ever want…” with “I am willing to…” and “I look forward to…”
    s6prefix: /^I don['’]t ever want\s+/i,
    s6: [
      { label: 'I am willing…', make: (rest) => (/^to\s/i.test(rest) ? `I am willing ${rest}` : `I am willing for ${rest}`) },
      { label: 'I look forward to…', make: lookForward },
    ],
    s6note: 'Adjust the wording so it reads naturally.',
  };

  const ui = {
    title: 'Byron Katie’s Worksheet',
    intro: 'The Judge-Your-Neighbor Worksheet from The Work of Byron Katie. Think of a stressful situation with someone, for example an argument. As you meditate on one specific time and place, write down your judgments, then question each one with the four questions and turn it around.',
    how: [
      ['Describe', ' the stressful situation and who it is with.'],
      ['Write', ' the six statements in short, simple sentences. It’s okay to be petty and judgmental.'],
      ['Question', ' each statement with the four questions.'],
      ['Turn it around', ' and find examples of how each turnaround is as true as, or truer than, the original.'],
    ],
    start: 'Start a worksheet',
    startSelected: 'Start with the selected text',
    untitled: 'New worksheet',
    progress: (done, total) => `${done}/${total} questioned`,
    deleteWs: 'Delete worksheet',
    deleteTitle: 'Delete this worksheet?',
    deleteMsg: (title) => `“${title}” and its answers will be removed from the notebook.`,
    cancel: 'Cancel',
    del: 'Delete',
    back: '← Back',
    next: 'Next →',
    stage: (n) => `${n} / 3`,

    situationTitle: 'The situation',
    situationText: 'Choose a stressful situation with someone, for example an argument. Meditate on one specific time and place.',
    nameLabel: 'Who is it with?',
    namePlaceholder: 'Name',
    situationLabel: 'What happened?',
    situationPlaceholder: 'One specific time and place…',
    useSelected: 'Use selected text',
    useEntry: 'Use current entry',
    selectFirst: 'Select text in the Diary tab first',
    toStatements: 'Write the statements →',
    someone: 'they',

    statementsTitle: 'The six statements',
    statementOf: (n) => `Statement ${n} of 6`,
    exampleLabel: 'Example: ',
    emotionPlaceholder: 'emotion',
    toBeliefs: 'Question the statements →',
    preview: 'Will be questioned as: ',

    beliefsTitle: 'Statements to question',
    beliefsText: 'Each card is one statement to question. Edit them so each holds one thought, and untick any you don’t want to question now.',
    addBelief: '+ Add a statement',
    remove: 'Remove',
    split: 'Split',
    splitHint: 'Place the cursor inside the statement where it should split.',
    include: 'Question this statement',
    begin: (n) => (n === 1 ? 'Question 1 statement →' : `Question ${n} statements →`),
    noBeliefs: 'Fill in at least one statement first.',
    fromStatement: (n) => `Statement ${n}`,

    inquiryOf: (pos, total) => `3 / 3 · Statement ${pos} of ${total}`,
    editBeliefs: 'Edit statements',
    summary: 'Summary',
    stepLabels: ['1', '2', '3', '4', 'Turn around'],
    stepTitles: ['Question 1', 'Question 2', 'Question 3', 'Question 4', 'Turnarounds'],
    yes: 'Yes',
    no: 'No',
    q3Placeholder: 'Notice what happens when you believe it…',
    q4Placeholder: 'Without the thought, I would be…',
    turnText: 'Turnaround',
    examplesLabel: 'Three examples',
    examplesPlaceholder: '1.\n2.\n3.',
    addTurn: '+ Add a turnaround',
    complete: (last) => (last ? 'Complete & see summary ✓' : 'Complete & next statement ✓'),
    skip: 'Skip this statement for now →',
    done: 'Statement questioned',

    summaryTitle: 'Summary',
    summaryDone: 'Worksheet complete',
    summaryProgress: (done, total) => `${done} of ${total} questioned`,
    isTrue: 'Is it true? ',
    absolutely: 'Can you absolutely know? ',
    reaction: 'When I believe it: ',
    without: 'Without the thought: ',
    turnarounds: 'Turnarounds: ',
    questioned: 'Questioned',
    notYet: 'Not yet questioned',
    review: 'Review',
    work: 'Question it',
    backStatements: '← Statements',
    addToDiary: 'Add summary to diary',
    backToDiary: 'Back to diary',
    diaryHeading: 'Byron Katie worksheet',
    with: 'With: ',
    added: 'Summary added to the diary',
  };

  const source = {
    url: 'https://thework.com/instruction-the-work-byron-katie/',
  };

  root.Katie = { statements, questions, turnaround, ui, source };
})(window);
