import { describe, expect, it } from 'vitest';
import { compareFr } from './sort';

describe('compareFr', () => {
  it('sorts labels in French: accents and case aside, numbers by value', () => {
    expect(['Zoé', 'élodie', 'Emma', 'eve', 'Étienne'].sort(compareFr)).toEqual([
      'élodie',
      'Emma',
      'Étienne',
      'eve',
      'Zoé',
    ]);
    expect(['Poste 10', 'Poste 2', 'Poste 1'].sort(compareFr)).toEqual([
      'Poste 1',
      'Poste 2',
      'Poste 10',
    ]);
  });
});
