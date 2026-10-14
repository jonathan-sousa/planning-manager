# Planning Manager

Outil de construction et d'optimisation des plannings mensuels du personnel paramédical d'un service d'urgences (hôpital public, roulement jour/nuit en 12h). Back-office réservé aux cadres de santé.

## Quick start

```bash
npm install
cp .envrc.example .envrc && direnv allow              # BOOTSTRAP_MANAGER_EMAIL + profil AWS
npm run infra:deploy                                  # déploie ton stage (-- <stage> pour un autre, -- prod pour la production), migre la base, écrit .env.local
npm run dev                                           # http://localhost:5173
```

Au premier déploiement d'un stage, le compte `BOOTSTRAP_MANAGER_EMAIL` est créé dans les groupes `MANAGERS` et `ADMINS` et reçoit par email un mot de passe temporaire, envoyé par `no-reply@planning-manager.lab.jonathan-sousa.com`. La connexion passe par la page Cognito Managed Login (redirection) ; l'inscription publique est désactivée.

## Usage

Connexion via Cognito Managed Login, page d'accueil avec vérification de la base et du solveur. Planning mensuel : grille agents × jours saisie au clavier comme un tableur (codes de postes, copier-coller, annulation), enregistrée automatiquement, avec violations des règles, compteurs d'heures et couverture en direct ; absences validées posées à la création du mois ; cycle brouillon → validé → publié, une violation dure ne passant la validation qu'acceptée avec une justification. Solveur OR-Tools : « Compléter » ou « Réoptimiser » un brouillon, proposition revue dans la grille (cases modifiées marquées) puis appliquée en une fois. Diagnostic d'un manque de couverture, agent par agent. Exports du mois : PDF A3 paysage pour l'affichage, CSV pour Excel ou un autre outil. Soldes d'heures : solde initial par agent, écart du mois enregistré à la publication, solde de fin de mois dans la grille et le PDF. Référentiels : agents, grades, compétences, postes (absences et repos compris). Planification : besoins de couverture et exceptions datées, demandes des agents, règles de planification (modifiables par les admins). Comptes (admins) : invitations, rôle admin, désactivation, réinitialisation du MFA, rebonds et plaintes des emails. Connexion avec MFA obligatoire (application d'authentification). Feuille de route : [`docs/architecture.md`](docs/architecture.md#feuille-de-route).

## Configuration

- **AWS** : compte JS Consulting, région `eu-west-3`, CDK bootstrappé. Le déploiement écrit dans AWS : il se lance avec un profil disposant des droits d'écriture (`jsconsulting-jsousa-dev`).
- **Stage** : une stack CloudFormation `PlanningManager-<stage>` par développeur ou environnement, désignée par son nom (minuscules, chiffres et tirets ; défaut : le nom d'utilisateur du poste, normalisé) : `npm run infra:deploy -- <nom>`, `STAGE=<nom>` pour les scripts de base, `-c stage=<nom>` pour les commandes `cdk` directes. `prod` active la protection contre la suppression, la rétention des ressources, les sauvegardes et l'hébergement sur le domaine ; les autres stages tournent avec le serveur Vite local.
- **Emails** : Cognito envoie par SES depuis `no-reply@planning-manager.lab.jonathan-sousa.com`. Le domaine d'envoi est la stack `PlanningManagerMail`, commune à tous les stages et déployée avec la production seulement : la modifier, c'est modifier la production. Sur un compte neuf, déployer d'abord la production (la vérification DKIM prend quelques minutes ; relancer la commande si le stage échoue faute de domaine vérifié).
- **`BOOTSTRAP_MANAGER_EMAIL`** (obligatoire) : email du premier compte (manager et admin) créé à chaque déploiement d'un stage neuf. Il est lu à la synthèse, et le déploiement échoue s'il manque. En local, dans un `.envrc` non versionné (`source_up` puis `export BOOTSTRAP_MANAGER_EMAIL=…`). Changer l'email crée un nouveau manager sans supprimer l'ancien.
- **Sorties CDK** : `cdk-outputs.<stage>.json`, écrit par `npm run infra:deploy`, non versionné. Les scripts de base (`db:migrate`, `db:status`, `db:seed`) le lisent pour ton stage, ou pour celui de `STAGE` (`STAGE=prod npm run db:status`).
- **`.env.local`** : écrit par `npm run infra:deploy` pour un stage de développement (ou `npm run env:write`), non versionné, requis par `npm run dev` (le serveur Vite en sert les valeurs comme `/config.json`).
- **Production** : `npm run infra:deploy -- prod` construit l'app puis déploie `PlanningManagerEdge-prod` (us-east-1) et `PlanningManager-prod`, servie sur <https://planning-manager.lab.jonathan-sousa.com> (connexion sur `auth.planning-manager.lab.jonathan-sousa.com`), puis migre sa base. Données fictives exclues : le seed refuse `prod`.
- **Runtimes** : Node 24 (`.nvmrc`), Python 3.14 pour le solveur (`solver/.python-version`), `uv` installé.

## Development

```bash
npm run check          # lint + types (web, api, infra) + build + tests
npm run test           # Vitest (dont des mois résolus par le solveur : exige uv)
npm run test:coverage  # Vitest avec la couverture de code (rapport dans coverage/)
npm run solver:test    # pytest du solveur (scénarios partagés, calendrier)
npm run infra:synth    # synthèse CDK locale (bundle l'API et le solveur, sans déployer)
npm run infra:watch    # redéploie à chaud l'API et le solveur à chaque modification
npm run db:generate    # génère une migration SQL (Drizzle) réécrite pour Aurora DSQL
npm run db:migrate     # applique les migrations au stage courant et relie le rôle IAM du solveur
npm run db:status      # avancement des migrations (-- --watch pour suivre)
npm run db:seed        # remplit le stage avec un service fictif (-- --reset pour remplacer les données)
pre-commit run --all-files
```

Détruire un stage de développement : `npm run infra:destroy -- -c stage=<nom>`. Les stacks de production sont protégées contre la suppression.

Documentation : [`docs/`](docs/README.md).

## License

Propriétaire — voir [`LICENSE`](LICENSE).
