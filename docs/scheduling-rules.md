# Règles de planification

Les valeurs par défaut suivent la fonction publique hospitalière (décret 2002-9). Toutes sont paramétrables dans `RuleSettings` et **restent à valider avec le protocole temps de travail local de l'établissement**.

## Contraintes dures

- **Un poste par jour** : un poste maximum par agent et par jour. Les absences validées et les cellules verrouillées ne bougent pas.
- **Repos quotidien** : au moins 12h consécutives. La comparaison est `≥` : un poste de jour 7h-19h suivi d'une nuit 19h-7h donne exactement 12h, ce qui est légal. Les paires de postes incompatibles sont pré-calculées en minutes absolues.
- **Amplitude et pause** : amplitude de 12h maximum (dérogation des urgences, pauses incluses) ; pause de 20 minutes au-delà de 6h de travail.
- **Durée hebdomadaire** : 48h maximum sur 7 jours glissants. Une nuit est imputée à son jour de début, une approximation documentée.
- **Repos hebdomadaire** :
  - 36h consécutives minimum ;
  - 4 jours de repos sur 2 semaines, dont 2 consécutifs incluant un dimanche.
  - Jour de repos : aucun poste ne commence ce jour-là et pas de nuit la veille (paramétrable).
  - Les quinzaines sont fixes, ancrées sur une date de `RuleSettings`.
- **Jours consécutifs** : nombre maximal de jours travaillés consécutifs (paramètre).
- **Mode jour/nuit** : `nightMode` respecté.
- **Qualification** : grade et compétence requis pour couvrir un besoin.
- **Continuité entre mois** :
  - les 13 derniers jours du mois précédent sont injectés comme contexte figé ;
  - le mois suivant est aussi vérifié s'il est déjà en brouillon.

## Contraintes souples

- **Couverture minimale** : une variable d'écart signale les trous, sans rendre le modèle infaisable.
- **Heures du mois** : proches de la cible (régime × quotité, jours fériés déduits, solde d'ouverture pris en compte), avec une tolérance.
- **Souhaits et équité** : souhaits des agents ; répartition équitable des week-ends, nuits et fériés ; pas de jours de repos isolés.
- **Stabilité** : `AddHint` sur le brouillon existant et pénalité de changement.

Les primes de dimanche, de jour férié et de nuit relèvent de la paie : elles sont hors de ces règles.

## Un seul validateur

`src/lib/rules/` (TypeScript) est la seule définition de ce qu'est une violation. Les scénarios `fixtures/rule-scenarios/*.json` servent trois fois :

- **Vitest** : le validateur TS produit exactement les violations attendues.
- **pytest** : le modèle CP-SAT, toutes variables fixées sur le scénario, est faisable si et seulement si aucune violation dure n'est attendue.
- **Bout en bout** : chaque sortie du solveur repasse dans le validateur TS, qui doit trouver zéro violation dure.
