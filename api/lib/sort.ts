// DSQL sorts text with the C collation: order labels here, in French.
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export const compareFr = (a: string, b: string): number => collator.compare(a, b);
