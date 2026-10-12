# Planning Manager

Outil de construction et d'optimisation des plannings mensuels du personnel paramédical d'un service d'urgences (hôpital public, roulement jour/nuit en 12h). Back-office réservé aux cadres de santé.

## Quick start

```bash
npm install
npx ampx sandbox --profile jsconsulting-jsousa-dev   # déploie le backend perso et génère amplify_outputs.json
npm run dev                                          # http://localhost:5173
```

Le premier compte se crée dans la console Cognito (inscription publique désactivée), puis s'ajoute au groupe `MANAGERS`.

## Usage

Phase 0 (fondations) : connexion, page d'accueil avec vérification du solveur, gestion des grades. La feuille de route complète est dans [`docs/architecture.md`](docs/architecture.md).

## Configuration

- **AWS** : compte JS Consulting, région `eu-west-3`. La sandbox écrit dans AWS : elle se lance avec un profil disposant des droits d'écriture.
- **`amplify_outputs.json`** : généré par la sandbox, non versionné, requis par `npm run dev` et `npm run build`.
- **Runtimes** : Node 24 (`.nvmrc`), Python 3.14 pour le solveur (`amplify/functions/solver/.python-version`), `uv` installé.

## Development

```bash
npm run check        # lint + types + tests + build
npm run test         # Vitest
npm run solver:test  # pytest du solveur
pre-commit run --all-files
```

Documentation : [`docs/`](docs/README.md).

## License

Propriétaire — voir [`LICENSE`](LICENSE).
