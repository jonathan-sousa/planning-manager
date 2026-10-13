# Planning Manager

Outil de construction et d'optimisation des plannings mensuels du personnel paramédical d'un service d'urgences (hôpital public, roulement jour/nuit en 12h). Back-office réservé aux cadres de santé.

## Quick start

```bash
npm install
cp .envrc.example .envrc && direnv allow              # BOOTSTRAP_MANAGER_EMAIL + profil AWS
npm run infra:deploy:mail                             # une fois par compte : domaine d'envoi SES (vérification DKIM en quelques minutes)
npm run infra:deploy                                  # déploie le stage perso (-- -c stage=<nom> pour un autre), écrit .env.local, migre la base
npm run dev                                           # http://localhost:5173
```

Au premier déploiement d'un stage, le compte `BOOTSTRAP_MANAGER_EMAIL` est créé dans le groupe `MANAGERS` et reçoit par email un mot de passe temporaire, envoyé par `no-reply@planning-manager.lab.jonathan-sousa.com`. La connexion passe par la page Cognito Managed Login (redirection) ; l'inscription publique est désactivée.

## Usage

Connexion via Cognito Managed Login, page d'accueil avec vérification de la base et du solveur. Planning mensuel : grille agents × jours saisie au clavier comme un tableur (codes de postes, copier-coller, annulation), enregistrée automatiquement, avec violations des règles, compteurs d'heures et couverture en direct ; absences validées posées à la création du mois ; cycle brouillon → validé → publié, une violation dure ne passant la validation qu'acceptée avec une justification. Solveur OR-Tools : « Compléter » ou « Réoptimiser » un brouillon, proposition revue dans la grille (cases modifiées marquées) puis appliquée en une fois. Diagnostic d'un manque de couverture, agent par agent. Référentiels : agents, grades, compétences, postes (absences et repos compris). Planification : besoins de couverture et exceptions datées, demandes des agents, règles de planification. Feuille de route : [`docs/architecture.md`](docs/architecture.md#feuille-de-route).

## Configuration

- **AWS** : compte JS Consulting, région `eu-west-3`, CDK bootstrappé. Le déploiement écrit dans AWS : il se lance avec un profil disposant des droits d'écriture (`jsconsulting-jsousa-dev`).
- **Stage** : une stack CloudFormation `PlanningManager-<stage>` par développeur ou environnement, choisie avec `-c stage=<nom>` (minuscules, chiffres et tirets ; défaut : le nom d'utilisateur du poste). `prod` active la protection contre la suppression, la rétention des ressources et les sauvegardes.
- **Emails** : Cognito envoie par SES depuis `no-reply@planning-manager.lab.jonathan-sousa.com`. Le domaine d'envoi est la stack `PlanningManagerMail`, commune à tous les stages, à déployer avant le premier stage (`npm run infra:deploy:mail`) ; un stage échoue tant que le domaine n'est pas vérifié.
- **`BOOTSTRAP_MANAGER_EMAIL`** (obligatoire) : email du premier manager créé à chaque déploiement d'un stage neuf. Il est lu à la synthèse, et le déploiement échoue s'il manque. En local, dans un `.envrc` non versionné (`source_up` puis `export BOOTSTRAP_MANAGER_EMAIL=…`). Changer l'email crée un nouveau manager sans supprimer l'ancien.
- **`.env.local`** : généré par `npm run env:write` à partir des sorties CDK (`cdk-outputs.json`), non versionné, requis par `npm run dev`, `npm run build`, `npm run db:migrate` et `npm run db:seed`.
- **Runtimes** : Node 24 (`.nvmrc`), Python 3.14 pour le solveur (`solver/.python-version`), `uv` installé.

## Development

```bash
npm run check          # lint + types (web, api, infra) + tests + build
npm run test           # Vitest (dont des mois résolus par le solveur : exige uv)
npm run solver:test    # pytest du solveur (scénarios partagés, calendrier)
npm run infra:synth    # synthèse CDK locale (bundle l'API et le solveur, sans déployer)
npm run infra:watch    # redéploie à chaud l'API et le solveur à chaque modification
npm run db:generate    # génère une migration SQL (Drizzle) réécrite pour Aurora DSQL
npm run db:migrate     # applique les migrations au stage courant
npm run db:seed        # remplit le stage avec un service fictif (-- --reset pour remplacer les données)
pre-commit run --all-files
```

Détruire un stage : `npm run infra:destroy -- -c stage=<nom>` (en `prod`, le coffre AWS Backup doit d'abord être vidé de ses points de restauration).

Documentation : [`docs/`](docs/README.md).

## License

Propriétaire — voir [`LICENSE`](LICENSE).
