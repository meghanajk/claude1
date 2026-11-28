import React from 'react';
import {Scene1Hook} from './Scene1Hook';
import {Scene2Setup} from './Scene2Setup';
import {Scene3Conformity} from './Scene3Conformity';
import {Scene4IllusoryTruth} from './Scene4IllusoryTruth';
import {Scene5Emotion} from './Scene5Emotion';
import {Scene6Gaslighting} from './Scene6Gaslighting';
import {Scene7Revelation} from './Scene7Revelation';
import {Scene8Ending} from './Scene8Ending';

export const SCENES: Record<string, React.FC> = {
  hook: Scene1Hook,
  setup: Scene2Setup,
  conformity: Scene3Conformity,
  illusory: Scene4IllusoryTruth,
  emotion: Scene5Emotion,
  gaslighting: Scene6Gaslighting,
  reveal: Scene7Revelation,
  ending: Scene8Ending,
};
