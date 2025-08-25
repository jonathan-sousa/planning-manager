#!/bin/bash

# Script pour configurer Husky (hooks Git)
# À exécuter après installation des dépendances

echo "🔧 Configuration de Husky pour les hooks Git..."

# Installer husky et lint-staged
npm install --save-dev husky lint-staged prettier eslint-config-prettier

# Initialiser husky
npx husky init

# Créer le hook pre-commit
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Linting et formatage automatique
npx lint-staged
EOF

# Créer le hook commit-msg pour vérifier le format des messages
cat > .husky/commit-msg << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Vérifier le format du message de commit
commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,100}$'
if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Format de commit invalide!"
    echo "📝 Format attendu: type(scope?): description"
    echo "Types valides: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert"
    exit 1
fi
EOF

# Rendre les hooks exécutables
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg

# Ajouter la configuration lint-staged dans package.json
echo "📝 Ajout de la configuration lint-staged..."
npm pkg set 'lint-staged[*.{js,jsx,ts,tsx}][0]=eslint --fix'
npm pkg set 'lint-staged[*.{js,jsx,ts,tsx}][1]=prettier --write'
npm pkg set 'lint-staged[*.{json,css,md}]=prettier --write'

echo "✅ Husky configuré avec succès!"
echo "🎉 Les hooks Git sont maintenant actifs:"
echo "   - pre-commit: Linting et formatage automatique"
echo "   - commit-msg: Validation du format des messages de commit"