/*
 * The Instrument for Peace worksheet by David Hoffmeister (Living Miracles),
 * transcribed from https://livingmiraclescenter.org/doc/instrument-for-peace.pdf
 *
 * {A} {B} {C1} {C2} {D} {E} are the answers from the Levels of Mind page. They are
 * shown in red in each step and can be fine-tuned in place, as on the original form.
 * A line starting with "!" is emphasised; a line that is only a token is shown as a block.
 */
(function (root) {
  'use strict';

  const fields = {
    A: { label: 'When I think about', hint: 'Past or future action, situation or event causing upset', level: 'perception' },
    B: { label: 'I feel', hint: 'Specific upsetting emotions', level: 'emotion' },
    C1: { label: 'Because I think that … is to blame', hint: 'Name (optional)', level: 'thought', optional: true },
    C2: { label: "and/or because I'm afraid that … will occur in the future", hint: 'Will occur (optional)', level: 'thought', optional: true },
    D: { label: "These thoughts and feelings prove that I'm right that", hint: 'My belief in lack, taking the form of an image of self/other/the world', level: 'belief' },
    E: { label: 'What I want(ed) and expect(ed) is for', hint: 'Desired action, situation or event', level: 'desire' },
  };

  const intro =
    'The mind at peace is healed. The mind at peace has wholeheartedly welcomed peace. In this world, ' +
    'lack of peace appears in many forms. For permanent healing to occur, lack of peace must be traced ' +
    'back to its singular cause in the mind. Use of this instrument for that tracing back can help a willing ' +
    'mind let go of what it thinks it knows, see the world differently, and experience a present state of peace and joy.';

  const levels = {
    quote: '"Truth is restored to you through your desire, as it was lost to you through your desire for something else." — A Course in Miracles T-20.VIII.1.2',
    desire: 'The desire for something to be different than what it is now is keeping you from the peace of God.',
    question: 'Are you willing to offer this desire to the Holy Spirit now in order to realign with the only goal that will bring you what you truly want? To accept peace of mind now?',
    resistance: 'If you experience any resistance to choosing the peace of God using the Levels of Mind Diagram, continue on with the Instrument for Peace. Feel free at any time to fine tune your responses as needed by changing the red text.',
  };

  const steps = [
    [
      'When I think about upsetting action, situation or event:',
      '{A}',
      'I feel:',
      '{B}',
      'Because I think that:',
      '{C1} is to blame and/or',
      "Because I'm afraid that:",
      '{C2} in the future.',
    ],
    [
      'Thinking about {A}',
      'Feeling {B}',
      'Blaming {C1} and/or',
      'Fearing {C2}',
      'Prove I am right that:',
      '{D}',
      'I do not like how I feel now, so I am ready to consider the possibility that the way I perceive this is not the way it really is. As part of the healing process, I am willing to look beyond my perception of this upset (the meaning I have given it) and look within my mind.',
    ],
    [
      'I want to learn that there is a way that I can, without guilt, see the part I play in:',
      'Thinking about {A}',
      'Feeling {B}',
      'Blaming {C1} and/or',
      'Fearing {C2}',
    ],
    [
      'I release my wanting to be right about my perception of all of this in:',
      'Thinking about {A}',
      'Feeling {B}',
      'Blaming {C1} and/or',
      'Fearing {C2}',
      'And proving that {D}',
      'I want instead to be happy. Through the ego (distorted thinking/seeing), I perceive the cause of my upset and its resolution as outside my mind. This projection seems very real; its purpose is to distract my mind from looking inward.',
    ],
    [
      "If the cause of my upset and its resolution were outside my mind, I would, in fact, be powerless to change my state of mind. My use of projection (seeing outside what I don't want to see within) is why I seem powerless, why:",
      '{C1} and/or',
      'Fearing {C2}',
      'seem(s) to be the cause of my upset.',
    ],
    [
      'Thinking about {A}',
      'Feeling {B}',
      'Blaming {C1} and/or',
      'Fearing {C2}',
      'Result from my belief that:',
      '{D}',
    ],
    [
      'I am only upset at someone or something when they/it mirror(s) back to my mind a belief which I have denied from awareness. When I blame/fear something in the world, it is to avoid seeing the upset and resolution as they really are (a decision in my mind) and to instead maintain an image of self/other/the world as I wish. This mind trick seems to displace guilt and fear, but actually maintains feelings of upset. To blame or fear an image of self/other/the world requires that I believe I am limited to a body and world of bodies, and denies the spiritual abstract reality of my being. As a first step in letting go of all upset, I want to see in my mind what I thought was outside it.',
      'Being upset about: {A}',
      'is only another attempt to make:',
      '{C1} and/or',
      'the future thought:',
      '{C2} the cause of my guilt and fear.',
    ],
    [
      'Upset seems valuable and justifiable when:',
      '{A}',
      'runs counter to what I want.',
      'What I want(ed) and expect(ed) is for:',
      '{E}',
      'I still believe that:',
      '{D}',
      'so I think I need for:',
      '{E}',
      'to be happy, complete, and at peace.',
      '!Is this belief in lack and the resulting expectation more important to me than peace of mind?',
    ],
    [
      "Everything in the world works together for my good. What I think is the cause of my upset is not the cause at all. The choice to be upset is a choice not to see the cause, my belief in separation/lack, as a present decision in my mind. It's an attempt to see the cause in the past/future and the present as its effect.",
    ],
    [
      '!What I want RIGHT NOW, above all else, is peace.',
      'So I question the belief that:',
      '{D}',
      'and I voluntarily let go of the desire for:',
      '{E}',
      'in order to reconnect with my one goal: peace.',
    ],
    [
      '!Peace of mind is a present decision which I gratefully choose RIGHT NOW!',
      'Guilt and fear of consequences only seemed possible because I was determined to hold on to a belief in past/future cause. I let go of the meaning I gave to the past/future and open my mind to the present, absolved and innocent.',
    ],
    [
      'I am grateful for the realization that the cause of my upset, which I thought was in the world, was actually only an unquestioned belief and decision in my mind; I have decided anew for my PEACE OF MIND.',
    ],
  ];

  const closing = 'Write down any insights from the process below. Do as many worksheets as necessary to experience present peace, if that is your desire.';

  const source = {
    title: 'Instrument for Peace — David Hoffmeister',
    url: 'https://livingmiraclescenter.org/doc/instrument-for-peace.pdf',
    home: 'https://livingmiracles.org',
  };

  root.Instrument = { fields, intro, levels, steps, closing, source };
})(window);
