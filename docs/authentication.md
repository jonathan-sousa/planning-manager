# L'authentification, pas à pas

Guide explicatif du système de connexion : Cognito, la page de connexion hébergée, les jetons et la bibliothèque Amplify. Pour simplifier, il part d'une application **sans API** : un site statique et Cognito. La dernière partie montre ce qu'une API ajoute.

## 1. Le problème

Une application doit savoir **qui** l'utilise. Deux questions distinctes :

- **Authentification** : « es-tu bien la personne que tu prétends être ? » (mot de passe, code à usage unique).
- **Autorisation** : « as-tu le droit de faire ceci ? » (être manager, être admin).

L'authentification vient d'abord : on ne décide de ce qu'une personne a le droit de faire qu'une fois sûr de son identité.

Écrire soi-même un système de connexion est risqué : stocker les mots de passe correctement, gérer le MFA, la réinitialisation, les tentatives répétées… On le délègue à un service spécialisé : **Cognito**.

## 2. Les acteurs

```text
                 ┌────────────────────────────┐
                 │ Navigateur de l'utilisateur │
                 └──────┬──────────────┬──────┘
         télécharge le  │              │  se connecte sur
         site           ▼              ▼
     ┌───────────────────────┐   ┌──────────────────────────────┐
     │ S3 + CloudFront       │   │ Cognito                      │
     │ fichiers du site :    │   │ user pool : les comptes      │
     │ HTML, JS, CSS,        │   │ Managed Login : la page de   │
     │ config.json           │   │ connexion, hébergée par AWS  │
     └───────────────────────┘   └──────────────────────────────┘
```

- **Le site** (S3 + CloudFront) n'est qu'un ensemble de **fichiers publics** : HTML, JavaScript, CSS. N'importe qui peut les télécharger et les lire. Il n'y a aucun serveur qui exécute du code pour un visiteur : tout le code tourne **dans le navigateur**.
- **Cognito** gère les comptes et la connexion. Il est composé :
  - d'un **user pool** : l'annuaire des comptes (email, mot de passe haché, MFA, groupes) ;
  - d'un **app client** : la déclaration de notre application auprès du user pool (ses adresses de retour autorisées, ce qu'elle a le droit de demander) ;
  - de **Managed Login** : la page de connexion, hébergée et affichée par Cognito sur son propre domaine.
- **Amplify** (la bibliothèque JavaScript `aws-amplify`) est du code **dans notre site**, qui parle à Cognito à notre place : il envoie vers la page de connexion, récupère les jetons, les garde et les renouvelle.

> Point clé : le site étant entièrement public, **il ne peut rien protéger**. Cacher un bouton à un non-admin, c'est de l'ergonomie, pas de la sécurité : quelqu'un qui modifie le JavaScript dans son navigateur verra le bouton. Une donnée n'est vraiment protégée que si un serveur la garde et vérifie qui la demande (partie 9).

## 3. Le user pool et l'app client

**Le user pool** stocke pour chaque compte :

- l'identifiant (ici l'email, sans distinction de majuscules) ;
- le mot de passe, **haché** : Cognito ne le connaît jamais en clair, il vérifie seulement qu'un mot de passe saisi produit le même hachage ;
- le secret du MFA (partie 7) ;
- les **groupes** (ici `MANAGERS` et `ADMINS`) ;
- l'état du compte : actif, désactivé, invitation en attente.

**L'app client** décrit notre site auprès du user pool :

- les **adresses de retour** autorisées après la connexion et la déconnexion (le domaine du site, ou `http://localhost:5173/` en développement). Cognito refuse de renvoyer l'utilisateur ailleurs : un site pirate ne peut pas se faire passer pour le nôtre pour récupérer une connexion ;
- les **informations demandées** (_scopes_) : `openid` (l'identité), `email`, `profile` ;
- le **type de flux** autorisé : ici, le flux par code avec PKCE (partie 4) ;
- **pas de secret client** : un secret mis dans un site public ne serait plus secret. On parle de **client public** ; PKCE remplace le secret.

## 4. La connexion, étape par étape

La connexion suit **OAuth 2.0** (le standard des délégations de connexion) et **OpenID Connect** (sa couche « identité »), avec le flux **Authorization Code + PKCE**.

```text
Navigateur                     Site (Amplify)                  Cognito
    │  ouvre le site                  │                            │
    │──────────────────────────────▶ │                            │
    │                                 │ 1. pas de session :        │
    │                                 │    prépare un secret       │
    │                                 │    (code_verifier)         │
    │ ◀─────── 2. redirection vers la page de connexion ───────────│
    │      (avec l'empreinte du secret : code_challenge)           │
    │                                                              │
    │ 3. email, mot de passe, code TOTP ─────────────────────────▶ │
    │                                                              │ vérifie
    │ ◀──── 4. redirection vers le site avec ?code=… ──────────────│
    │                                 │                            │
    │──────────────────────────────▶ │ 5. échange le code +       │
    │                                 │    le secret d'origine     │
    │                                 │───────────────────────────▶│
    │                                 │ ◀── 6. les trois jetons ───│
    │                                 │ 7. les garde, l'appli      │
    │                                 │    s'affiche               │
```

1. **Le site s'ouvre sans session.** Amplify génère un secret aléatoire (`code_verifier`) et en calcule l'empreinte (`code_challenge`).
2. **Redirection vers la page de connexion de Cognito**, avec l'empreinte. Le site ne voit **jamais** le mot de passe : la saisie a lieu sur le domaine de Cognito.
3. **L'utilisateur s'identifie** : email, mot de passe, code TOTP. À la première connexion, il remplace son mot de passe temporaire et enrôle son application d'authentification.
4. **Cognito renvoie vers le site**, sur une adresse de retour autorisée, avec un **code à usage unique** dans l'URL (`?code=…`). Ce code n'est pas un jeton : seul, il ne donne accès à rien.
5. **Amplify échange le code contre les jetons**, en joignant le secret d'origine. Cognito vérifie que ce secret correspond à l'empreinte reçue à l'étape 2.
6. **Cognito remet les trois jetons** (partie 5).
7. **Amplify les garde** et l'application s'affiche.

**Pourquoi un code, puis un échange, plutôt que les jetons directement dans l'URL ?** Une URL laisse des traces : historique, journaux, extensions du navigateur. Le code n'y reste que quelques secondes et ne sert qu'une fois.

**Pourquoi PKCE ?** Si quelqu'un interceptait le code à l'étape 4, il ne pourrait pas l'échanger : il lui manque le secret, resté dans le navigateur de l'utilisateur. PKCE remplace le secret client qu'un site public ne peut pas garder.

## 5. Les jetons

Cognito remet trois jetons, chacun avec son rôle :

| Jeton                         | Dit                                                         | Durée par défaut |
| ----------------------------- | ----------------------------------------------------------- | ---------------- |
| **Jeton d'identité** (ID)     | **Qui** est connecté : email, nom, identifiant, groupes     | 1 heure          |
| **Jeton d'accès** (access)    | **Ce qu'il peut faire** : identifiant, groupes, application | 1 heure          |
| **Jeton de rafraîchissement** | Rien de lisible : une clé pour obtenir de nouveaux jetons   | 30 jours         |

Ces durées sont réglables par app client : de 5 minutes à 1 jour pour les deux premiers, de 1 heure à 10 ans pour le troisième.

**Le format JWT.** Les jetons d'identité et d'accès sont des **JWT** (_JSON Web Tokens_) : trois morceaux séparés par des points.

```text
eyJraWQiOi…  .  eyJzdWIiOiI0…  .  kXq3vA…
   en-tête         contenu           signature
```

- **L'en-tête** dit comment le jeton est signé.
- **Le contenu** (_payload_) porte les **claims** : `sub` (l'identifiant unique), `email`, `cognito:groups`, `exp` (l'expiration), `token_use` (`id` ou `access`)…
- **La signature** est calculée par Cognito avec sa **clé privée**.

Deux conséquences importantes :

- **Un JWT est signé, pas chiffré.** Le contenu est simplement encodé : n'importe qui peut le lire (essayer sur [jwt.io](https://jwt.io)). On n'y met donc rien de secret.
- **Un JWT ne peut pas être modifié.** Changer un seul caractère du contenu (s'ajouter le groupe `ADMINS`) rend la signature fausse. Toute personne qui possède la **clé publique** de Cognito, publiée par le user pool, peut le vérifier, sans demander quoi que ce soit à Cognito.

## 6. Ce que fait Amplify dans le navigateur

- **Il garde les jetons** dans le `localStorage` du navigateur (son stockage par défaut). Ce stockage appartient au **seul domaine du site** : un autre site ouvert dans le navigateur ne peut pas le lire.
- **Il renouvelle les jetons.** Avant l'expiration des jetons d'identité et d'accès, il envoie le jeton de rafraîchissement à Cognito et reçoit des jetons neufs. L'utilisateur reste connecté sans rien voir, tant que le jeton de rafraîchissement est valable (30 jours).
- **Il fournit la session** à l'application : `fetchAuthSession()` donne les jetons courants, `getCurrentUser()` dit si quelqu'un est connecté.
- **Il déconnecte** : `signOut()` efface les jetons du navigateur, révoque le jeton de rafraîchissement auprès de Cognito et passe par la page de déconnexion de Cognito.

**Le cookie de la page de connexion.** En plus des jetons, Cognito pose sur **son propre domaine** un cookie de session valable une heure : revenir sur la page de connexion dans l'heure reconnecte sans ressaisir ses identifiants. La déconnexion l'efface.

## 7. Le MFA par application (TOTP)

**MFA** (_multi-factor authentication_) : il faut deux preuves de natures différentes. Ici, **ce qu'on sait** (le mot de passe) et **ce qu'on a** (son téléphone).

**TOTP** (_Time-based One-Time Password_) :

1. **À l'enrôlement**, Cognito génère un **secret partagé** et l'affiche sous forme de QR code. L'application d'authentification du téléphone (Google Authenticator, 1Password, Authy…) le scanne et le garde.
2. **Toutes les 30 secondes**, le téléphone calcule un code à 6 chiffres à partir du secret et de l'heure courante. Cognito fait le même calcul de son côté.
3. **À la connexion**, les deux codes doivent correspondre.

Le téléphone n'a pas besoin de réseau : seuls le secret et l'heure comptent. Un mot de passe volé ne suffit plus, il faut aussi le téléphone.

**Téléphone perdu** : un admin réinitialise le MFA du compte ; l'utilisateur enrôle une nouvelle application à sa connexion suivante.

## 8. La déconnexion et la fin de session

| Événement                           | Effet                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| L'utilisateur se déconnecte         | Jetons effacés du navigateur, jeton de rafraîchissement révoqué, cookie de la page de connexion effacé |
| Le jeton de rafraîchissement expire | Au renouvellement suivant, Amplify n'obtient plus rien : retour à la page de connexion                 |
| Un admin désactive le compte        | Le compte ne peut plus se connecter ; ses jetons de rafraîchissement sont révoqués                     |

**Les jetons déjà émis ne sont pas « rappelés ».** Un jeton d'accès reste techniquement valable jusqu'à son expiration : sa vérification se fait avec la clé publique, sans demander à Cognito si la session existe encore. Révoquer, c'est empêcher d'en obtenir de **nouveaux**. La fenêtre maximale est donc la durée de vie du jeton d'accès.

## 9. Ce que le site peut, et ne peut pas, faire

Avec les jetons, le site peut :

- **afficher** le nom, l'email, adapter l'interface aux groupes (montrer la page Comptes aux admins) ;
- **décider** quand renvoyer vers la page de connexion.

Il ne peut pas :

- **protéger des données** : tout ce qui est dans le code du site ou dans ses fichiers est public ;
- **empêcher un utilisateur de contourner l'interface** : modifier le JavaScript, appeler directement ce qu'il veut.

Tant qu'il n'y a pas de serveur, la connexion sert donc à **personnaliser l'interface**, pas à **sécuriser**. La sécurité réelle arrive avec une API qui vérifie elle-même les jetons.

### Les points de vigilance d'un site qui garde des jetons

- **HTTPS partout** : sans chiffrement, les jetons pourraient être interceptés.
- **Le XSS** (_cross-site scripting_) : un script malveillant injecté dans la page pourrait lire le `localStorage`, donc les jetons. D'où la **CSP** (_Content Security Policy_) du site, qui n'autorise que les scripts de l'application et les échanges avec Cognito et l'API.
- **Les adresses de retour** strictement listées dans l'app client.
- **Des jetons d'accès courts** : une fuite ne dure qu'une heure au plus.

## 10. Et avec une API

Une API change tout : elle garde les données, et c'est elle qui décide.

```text
Navigateur ──── Authorization: Bearer <jeton d'accès> ───▶ API Gateway ──▶ Lambda
                                                            │                 │
                                                vérifie la signature,   vérifie le type
                                                l'émetteur, le          de jeton et les
                                                destinataire,           groupes (MANAGERS,
                                                l'expiration            ADMINS)
```

- Le site envoie le **jeton d'accès** (pas le jeton d'identité) avec chaque appel.
- L'API **ne fait pas confiance au site** : elle vérifie le jeton avec la clé publique de Cognito, puis décide selon les groupes. Un appel sans jeton valide, depuis un autre site ou un script, est refusé.
- Le jeton de rafraîchissement ne quitte jamais le navigateur, sauf vers Cognito.

Le détail des barrières de l'API est dans [architecture.md § API](architecture.md#api).

## 11. Dans ce projet

| Élément                              | Où                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------- |
| User pool, app client, Managed Login | `infra/lib/auth.ts`                                                         |
| Configuration d'Amplify              | `src/main.tsx` (identifiants lus dans `/config.json`)                       |
| Redirection vers la connexion        | `src/auth/auth-gate.tsx`                                                    |
| Lecture de la session                | `src/auth/session.ts` (email du jeton d'identité, groupes du jeton d'accès) |
| Écran « Accès refusé » hors managers | `src/auth/manager-gate.tsx`                                                 |
| Envoi du jeton d'accès à l'API       | `src/lib/api-client.ts`                                                     |
| Vérification côté API                | `infra/lib/api.ts` (authorizer), `api/middleware/auth.ts`                   |

Réglages retenus :

- **inscription fermée** : un admin invite, Cognito envoie un mot de passe temporaire ;
- **MFA obligatoire** par application d'authentification ;
- **email insensible à la casse** ;
- **connexion uniquement par Managed Login** : l'app client n'autorise que le flux par code et le renouvellement de session, aucune connexion directe par mot de passe ;
- **durées de jetons par défaut** : 1 heure (identité, accès), 30 jours (rafraîchissement).

## Glossaire

| Terme                 | Sens                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| User pool             | L'annuaire des comptes dans Cognito                                                 |
| App client            | Une application déclarée auprès du user pool, avec ses adresses de retour           |
| Managed Login         | La page de connexion hébergée par Cognito                                           |
| OAuth 2.0             | Standard de délégation : une application obtient un accès sans voir le mot de passe |
| OpenID Connect (OIDC) | Couche d'OAuth 2.0 qui ajoute l'identité (le jeton d'identité)                      |
| PKCE                  | Preuve qu'un code est échangé par l'application qui l'a demandé, sans secret client |
| JWT                   | Jeton signé, lisible par tous, impossible à modifier sans casser la signature       |
| Claim                 | Une information portée par un JWT (`email`, `cognito:groups`, `exp`…)               |
| MFA                   | Connexion à deux preuves de natures différentes                                     |
| TOTP                  | Code à 6 chiffres recalculé toutes les 30 secondes à partir d'un secret partagé     |
| XSS                   | Injection d'un script malveillant dans une page                                     |
| CSP                   | Liste des sources qu'une page a le droit de charger ou de contacter                 |
