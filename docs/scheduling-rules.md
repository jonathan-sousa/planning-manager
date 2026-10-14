# Règles de planification

Les valeurs par défaut suivent la fonction publique hospitalière (décret 2002-9). Toutes sont paramétrables dans `RuleSettings` et **restent à valider avec le protocole temps de travail local de l'établissement**.

## Contraintes dures

Le validateur `api/rules/` les applique (violations « dures »). Il calcule avec 13 jours de contexte de part et d'autre du mois et ne signale que des jours du mois.

- **Un poste par jour** : garanti par la base (une case par agent et par jour). Les cellules verrouillées ne bougent pas.
- **Absence validée** : chaque jour d'une absence validée porte son code d'absence.
- **Repos quotidien** : au moins 12h consécutives entre deux postes travaillés, en heure réelle (changement d'heure compris). La comparaison est `≥` : deux nuits 19h-7h de suite laissent exactement 12h, ce qui est légal.
- **Amplitude et pause** : amplitude de 12h maximum (dérogation des urgences, pauses incluses) ; pause de 20 minutes au-delà de 6h de travail. Mesurées sur les horaires du poste : la nuit du changement d'heure d'octobre (13h réelles) n'est pas un poste plus long.
- **Durée hebdomadaire** : 48h maximum sur toute période de 7 jours glissants. Une nuit est imputée à son jour de début.
- **Repos hebdomadaire** : toute période de 7 jours glissants rencontre un repos d'au moins 36h consécutives.
- **Quinzaine** : sur chaque quinzaine fixe (ancrée sur une date de `RuleSettings`), au moins 4 jours de repos, dont 2 consécutifs incluant un dimanche. Jour de repos : aucun poste travaillé ne commence ce jour-là et, paramétrable, pas de nuit la veille. Une quinzaine qui déborde du contrat de l'agent n'est pas vérifiée.
- **Jours consécutifs** : nombre maximal de jours travaillés d'affilée (paramètre).
- **Mode jour/nuit** : un agent « jour uniquement » ne prend pas de poste de nuit, et inversement.
- **Qualification** : seuls les agents du grade, et de la compétence quand le besoin en précise une, comptent pour la couverture.

Une même règle en échec sur plusieurs fenêtres glissantes successives est signalée une fois, sur la première.

## Contraintes souples

- **Couverture minimale** : par jour, poste, grade et compétence ; une exception datée remplace le besoin standard du même créneau. Le solveur la traite par une variable d'écart, sans rendre le modèle infaisable.
- **Heures du mois** : écart entre les heures créditées (postes travaillés et absences) et la cible, au-delà de la tolérance. Cible : obligation annuelle du régime (1 607 h, 1 582 h, 1 476 h ; le régime mixte va de 1 607 h vers 1 476 h selon sa part d'heures de nuit) × quotité, au prorata des jours de contrat du mois.
- **Souhaits** : souhait de repos sur un jour travaillé, souhait de poste non satisfait.
- **Repos isolé** : un jour vide ou de repos entre deux jours travaillés (un congé n'en est pas un).
- **Équité** (solveur) : répartition des week-ends, nuits et fériés ; compteurs affichés dans la grille.
- **Stabilité** (solveur) : `AddHint` sur le brouillon existant et pénalité de changement.

Les primes de dimanche, de jour férié et de nuit relèvent de la paie : elles sont hors de ces règles.

## Interprétations à valider

Le décret laisse de la marge sur ces points ; le validateur retient une lecture indulgente (une fausse alerte répétée finit par faire ignorer les vraies). À confirmer avec le protocole local et le cadre de santé :

- **Repos de 36h** : exigé sur toute période de 7 jours glissants (un repos qui chevauche deux semaines compte pour les deux), et non par semaine civile.
- **Jours de repos de la quinzaine** : un jour d'absence (congé, formation) compte comme jour de repos.
- **Mois voisin sans planning** : ses jours comptent comme des repos ; aucune alerte en bordure de mois tant qu'il n'est pas saisi.
- **Cible d'heures** : prorata calendaire de l'obligation annuelle ; les fériés et le mode de crédit des absences dépendent du protocole local.
- **Soldes d'heures** : écart cumulé entre heures créditées et cible, à partir d'un solde initial saisi par agent ; un mois ne compte qu'une fois publié, et un mois rouvert garde sa dernière publication jusqu'à la suivante.

## Un seul validateur

`api/rules/` (TypeScript, sans dépendance) est la seule définition de ce qu'est une violation : la grille l'exécute à chaque saisie, l'API avant la publication. Les scénarios `fixtures/rule-scenarios/*.json` (postes et paramètres communs dans `_shifts.json` et `_settings.json`) servent trois fois :

- **Vitest** (`api/rules/validate.test.ts`) : le validateur produit exactement les violations attendues pour les règles que le scénario déclare.
- **pytest** (`solver/tests/test_scenarios.py`) : le modèle CP-SAT, toutes les cases figées comme dans le scénario, trouve une violation dure exactement quand le validateur en trouve une (champ `hard` du scénario, vérifié par Vitest).
- **Bout en bout** (`scripts/solver.e2e.test.ts`) : une proposition du solveur sur le service fictif repasse dans le validateur, qui ne trouve aucune violation dure.
- **Mois aléatoires** (`scripts/solver.random.test.ts`) : de petits mois générés (changement d'heure, cases de contexte et verrouillées, absences, contrats partiels, poste finissant à minuit, deux modes) ; quand le solveur annonce zéro violation dure, le validateur doit être d'accord.

Écarts assumés du solveur, tous plus stricts que le validateur ou propres à l'objectif :

- le repos de 36h est imposé par une condition suffisante : deux jours sans poste, ou un jour sans poste entre deux postes assez espacés. Avec les postes usuels, elle couvre un minimum jusqu'à environ 41 h ; au-delà (48 h par exemple), elle ne suffit plus et le solveur peut proposer des violations que le validateur signalera ;
- la cible d'heures du régime mixte vaut 1 607 h dans l'objectif (le validateur la module selon la part de nuit).
