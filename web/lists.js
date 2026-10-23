/*
 * Reference lists for the Emotions and Beliefs tabs: words to help name
 * B (specific upsetting emotions) and D (the belief in lack) on the worksheet.
 */
(function (root) {
  'use strict';

  const emotions = {
    title: 'Common emotions',
    intro: 'Naming the feeling precisely helps when filling in B, "I feel". "I am never upset for the reason I think." (A Course in Miracles, Lesson 5)',
    style: 'chips',
    groups: [
      { name: 'Anger', items: ['angry', 'irritated', 'annoyed', 'frustrated', 'resentful', 'bitter', 'furious', 'impatient', 'indignant', 'jealous', 'envious', 'disgusted'] },
      { name: 'Fear', items: ['afraid', 'anxious', 'worried', 'nervous', 'insecure', 'panicked', 'overwhelmed', 'threatened', 'uneasy', 'tense', 'dreading', 'suspicious'] },
      { name: 'Sadness', items: ['sad', 'hurt', 'lonely', 'disappointed', 'grieving', 'hopeless', 'discouraged', 'rejected', 'abandoned', 'empty', 'heavy', 'depressed'] },
      { name: 'Guilt and shame', items: ['guilty', 'ashamed', 'embarrassed', 'humiliated', 'unworthy', 'regretful', 'foolish', 'exposed', 'inadequate', 'self-critical'] },
      { name: 'Feeling powerless', items: ['helpless', 'trapped', 'stuck', 'confused', 'invisible', 'unappreciated', 'misunderstood', 'judged', 'betrayed', 'used', 'controlled', 'drained'] },
    ],
  };

  const beliefs = {
    title: 'Common beliefs in lack',
    intro: 'Field D asks for the belief behind the upset, which takes the form of an image of self, other or the world. If one of these rings true, put it in your own words.',
    style: 'list',
    groups: [
      { name: 'About myself', items: [
        'I am not good enough.',
        'I am unlovable as I am.',
        'I have to earn love and approval.',
        'I am alone.',
        'I am powerless to change how I feel.',
        'I am a failure.',
        'I don\'t matter; I am invisible.',
        'I have done something wrong and deserve to be punished.',
        'I don\'t deserve to be happy.',
        'I am a body that can be hurt.',
        'I can\'t trust myself.',
      ] },
      { name: 'About others', items: [
        'People can\'t be trusted.',
        'Others will leave me.',
        'Others don\'t care about me.',
        'People are judging me.',
        'Someone else is responsible for how I feel.',
        'Others have what I lack.',
        'They have to change for me to be at peace.',
        'Others can take my peace away.',
      ] },
      { name: 'About the world and life', items: [
        'The world is not safe.',
        'There isn\'t enough: time, money, love.',
        'Life is unfair.',
        'I need to be in control to be safe.',
        'I will be happy when something changes.',
        'The past decides my present.',
        'I have to do everything on my own.',
        'Suffering is the price of being here.',
        'I am separate from God.',
      ] },
    ],
  };

  root.Lists = { emotions, beliefs };
})(window);
