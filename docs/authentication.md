# L'authentification, pas à pas

Guide explicatif du système de connexion, qui ajoute la complexité par niveaux et suit le fonctionnement réel du projet.

**Niveau 1, ce guide : Cognito et un site sans serveur.** Un **site statique** (S3 + CloudFront), **Cognito** et la bibliothèque **Amplify**, rien d'autre. Le MFA et l'API viendront dans les niveaux suivants.

## 1. Le problème

Une application doit savoir **qui** l'utilise. On distingue deux questions :

- **Authentification** : « es-tu bien la personne que tu prétends être ? »
- **Autorisation** : « as-tu le droit de faire ceci ? »

Ce guide traite la première. Écrire soi-même un système de connexion est risqué : stocker les mots de passe correctement, gérer la réinitialisation, les tentatives répétées… On le délègue à un service spécialisé : **Cognito**.

## 2. Les acteurs

```text
                 ┌──────────────────────────────┐
                 │ Navigateur de l'utilisateur  │
                 └──────┬────────────────┬──────┘
          télécharge le │                │ se connecte sur
          site          v                v
     ┌───────────────────────┐   ┌──────────────────────────────┐
     │ S3 + CloudFront       │   │ Cognito                      │
     │ fichiers du site :    │   │ user pool : les comptes      │
     │ HTML, JS, CSS,        │   │ Managed Login : la page de   │
     │ config.json           │   │ connexion, hébergée par AWS  │
     └───────────────────────┘   └──────────────────────────────┘
```

- **Le site** n'est qu'un ensemble de **fichiers publics**. Aucun serveur n'exécute de code pour le visiteur : tout le code tourne **dans son navigateur**.
- **Cognito** gère les comptes et la connexion :
  - le **user pool** est l'annuaire des comptes : email, mot de passe (haché, jamais stocké en clair), groupes ;
  - l'**app client** déclare notre site auprès du user pool : ses adresses de retour autorisées et ce qu'il a le droit de demander ;
  - **Managed Login** est la page de connexion, affichée par Cognito sur **son propre domaine**.
- **Amplify** (`aws-amplify`) est une bibliothèque JavaScript **dans notre site**. Elle envoie vers la page de connexion, récupère les jetons, les garde et les renouvelle.

> Le site étant entièrement public, **il ne protège rien**. Cacher un bouton à un non-admin relève de l'ergonomie : quelqu'un qui modifie le JavaScript dans son navigateur verra le bouton. Une donnée n'est protégée que si un serveur la garde et vérifie qui la demande.

**L'app client n'a pas de secret.** Un secret placé dans un site public ne resterait pas secret. On parle de **client public**, et c'est PKCE (partie 5) qui le remplace.

**Les adresses de retour sont listées dans l'app client** : le domaine du site, ou `http://localhost:5173/` en développement. Cognito refuse de renvoyer l'utilisateur ailleurs, si bien qu'un site pirate ne peut pas recevoir une connexion destinée au nôtre.

## 3. OAuth 2.0, OpenID et OpenID Connect

Trois noms proches, trois choses différentes. Cognito et Amplify parlent les deux derniers standards de ce tableau ; le premier est un ancêtre homonyme.

| Standard                  | Année | Répond à                       | Ce qu'il produit                | Aujourd'hui                  |
| ------------------------- | ----- | ------------------------------ | ------------------------------- | ---------------------------- |
| **OpenID** (1.0, 2.0)     | 2005  | « qui es-tu ? »                | Une identité sous forme d'URL   | Abandonné, remplacé par OIDC |
| **OAuth 2.0**             | 2012  | « à quoi as-tu droit ? »       | Un **jeton d'accès**            | Le standard de la délégation |
| **OpenID Connect** (OIDC) | 2014  | « qui es-tu ? », sur OAuth 2.0 | Un **jeton d'identité** en plus | Le standard de la connexion  |

**OAuth 2.0 est un standard d'autorisation, pas de connexion.** Il a été conçu pour qu'une application obtienne un accès limité aux données d'un utilisateur ailleurs, sans connaître son mot de passe. Exemple : autoriser un outil de mise en page à lire les photos d'un compte Google. Il délivre un **jeton d'accès** (« le porteur de ce jeton a le droit de lire ces photos »), mais ne définit pas comment l'application apprend **qui** est l'utilisateur.

**OpenID**, l'ancien, réglait justement l'identité, mais avec son propre mécanisme : l'utilisateur s'identifiait par une URL qui lui appartenait, chez le fournisseur de son choix. Il n'est plus utilisé.

**OpenID Connect est une couche au-dessus d'OAuth 2.0**, publiée par la même fondation qu'OpenID (d'où le nom), mais **sans rien reprendre d'OpenID** : il réutilise tout OAuth 2.0 et y ajoute ce qui manque pour une connexion :

- le **scope `openid`** : le demander, c'est dire « je veux aussi savoir qui est l'utilisateur » ;
- le **jeton d'identité**, un JWT au format standard : `sub` (identifiant), `email`, `name`… (partie 6) ;
- un **document de découverte** public, qui décrit le fournisseur : ses adresses (`/oauth2/authorize`, `/oauth2/token`…) et l'emplacement de ses clés publiques. Pour un user pool Cognito :
  `https://cognito-idp.<région>.amazonaws.com/<user pool>/.well-known/openid-configuration`

En pratique, quand un site propose « Se connecter avec Google », c'est OpenID Connect. Ici, **Cognito est le fournisseur OpenID Connect** et notre site est le client. C'est pourquoi l'app client demande les scopes `openid email profile`, et pourquoi on reçoit un jeton d'identité en plus du jeton d'accès.

### Les scopes : ce que l'application demande

`openid`, `email` et `profile` sont des **scopes** : des **permissions demandées** au moment de la connexion, pas des données. Chacun ouvre l'accès à un groupe d'informations (des **claims**).

| Scope     | Ce qu'il demande                                                                | Claims concernés                                                                     |
| --------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `openid`  | « Je fais de l'OpenID Connect » : obligatoire pour recevoir un jeton d'identité | `sub` : l'identifiant unique et permanent de l'utilisateur                           |
| `email`   | L'adresse email                                                                 | `email`, `email_verified`                                                            |
| `profile` | Les informations de profil standard                                             | `name`, `given_name` (prénom), `family_name` (nom), `nickname`, `picture`, `locale`… |

- **`openid` n'est pas l'identifiant de l'utilisateur** : c'est l'interrupteur qui active OpenID Connect. Sans lui, on fait de l'OAuth 2.0 pur, avec un jeton d'accès mais sans jeton d'identité. L'identifiant, c'est le claim **`sub`** (_subject_).
- **`profile` ne renvoie que ce que le compte contient.** Ici, le seul attribut de profil renseigné est `name`, saisi par l'admin à l'invitation.
- **Une nuance propre à Cognito** : avec `openid`, le jeton d'identité contient déjà tous les attributs que l'app client a le droit de lire, email compris. `email` et `profile` règlent surtout ce que renvoie l'adresse `/oauth2/userInfo`, qu'une application peut interroger avec le jeton d'accès, et la liste des scopes inscrite dans ce jeton.

## 4. La connexion, vue d'ensemble

La connexion suit **OpenID Connect**, donc OAuth 2.0, avec le flux **Authorization Code + PKCE**.

```text
Navigateur / site (Amplify)                                 Cognito
    │                                                             │
    │ 1. pas de session : prépare un secret de connexion          │
    │ 2. redirige vers la page de connexion ─────────────────────>│
    │                                                             │
    │ 3. l'utilisateur saisit email et mot de passe ─────────────>│ vérifie
    │                                                             │
    │ 4. Cognito renvoie vers le site avec ?code=... <────────────│
    │                                                             │
    │ 5. le site échange le code (+ son secret) ─────────────────>│ contrôle
    │ 6. Cognito remet les trois jetons <─────────────────────────│
    │ 7. Amplify les garde, l'application s'affiche               │
```

Le site ne voit **jamais** le mot de passe : la saisie a lieu sur le domaine de Cognito. Ce que le site reçoit à la fin, ce sont des **jetons**.

**Pourquoi un code, puis un échange, plutôt que les jetons directement dans l'URL ?** Une URL laisse des traces : historique, journaux, extensions du navigateur. Le code n'y reste que quelques secondes, il ne sert qu'une fois, et seul il ne donne accès à rien.

## 5. PKCE en détail

**PKCE** (_Proof Key for Code Exchange_, prononcé « pixy ») répond à une question : comment Cognito sait-il que celui qui échange le code (étape 5) est bien le site qui a lancé la connexion (étape 2), alors que ce site n'a aucun secret permanent ?

Réponse : le site invente **un secret à usage unique** pour chaque connexion, et ne montre d'abord que son **empreinte**.

### L'analogie du vestiaire

On dépose son manteau, on garde un ticket. Le vestiaire ne rend le manteau qu'à celui qui présente le ticket. Ici, Cognito garde l'empreinte, le site garde le ticket : le secret.

### Les ingrédients

- **`code_verifier`** : une longue chaîne aléatoire, générée par Amplify au début de chaque connexion. C'est **le secret**. Il reste dans le navigateur.
- **`code_challenge`** : l'**empreinte** du secret : `BASE64URL(SHA-256(code_verifier))`.
- **`code_challenge_method=S256`** : la méthode de calcul, SHA-256, la seule qu'accepte Cognito.

SHA-256 est une **fonction de hachage à sens unique** : on calcule facilement l'empreinte à partir du secret, mais il est impossible de retrouver le secret à partir de l'empreinte. L'empreinte peut donc voyager dans une URL sans risque.

### Le déroulé

**Étape 2 : la demande de connexion.** Amplify génère le `code_verifier`, le garde dans le navigateur, calcule l'empreinte et redirige vers la page de connexion :

```text
GET https://auth.planning-manager.lab.jonathan-sousa.com/oauth2/authorize
    ?response_type=code
    &client_id=<identifiant de l'app client>
    &redirect_uri=https://planning-manager.lab.jonathan-sousa.com/
    &scope=openid email profile
    &state=<valeur aléatoire>
    &code_challenge=<empreinte>
    &code_challenge_method=S256
```

Cognito **mémorise l'empreinte** avec la connexion en cours. Le paramètre `state` est une autre valeur aléatoire, que Cognito renverra telle quelle : Amplify vérifie au retour que c'est bien la sienne, ce qui empêche un autre site de lui injecter une connexion qu'il n'a pas lancée.

**Étape 4 : le retour.** Après la saisie du mot de passe, Cognito redirige :

```text
https://planning-manager.lab.jonathan-sousa.com/?code=<code à usage unique>&state=<la même valeur>
```

**Étape 5 : l'échange.** Amplify envoie le code **et le secret d'origine**, en clair cette fois, dans une requête directe (pas dans l'URL) :

```text
POST https://auth.planning-manager.lab.jonathan-sousa.com/oauth2/token

grant_type=authorization_code
code=<le code reçu>
client_id=<identifiant de l'app client>
redirect_uri=https://planning-manager.lab.jonathan-sousa.com/
code_verifier=<le secret d'origine>
```

**Le contrôle de Cognito** : il recalcule `SHA-256(code_verifier)` et le compare à l'empreinte mémorisée à l'étape 2. S'ils correspondent, il remet les jetons, sinon il refuse.

### Ce que PKCE empêche

Supposons qu'un attaquant intercepte le code à l'étape 4, par une extension malveillante ou une URL tombée dans un journal :

- il a le **code**, mais pas le **`code_verifier`**, resté dans le navigateur de l'utilisateur ;
- il a peut-être vu l'**empreinte** à l'étape 2, mais il ne peut pas en déduire le secret ;
- sans le secret, Cognito refuse l'échange : **le code volé ne sert à rien**.

## 6. Les jetons

À l'étape 6, Cognito remet **trois jetons** :

| Jeton                         | Dit                                                         | Durée par défaut |
| ----------------------------- | ----------------------------------------------------------- | ---------------- |
| **Jeton d'identité** (ID)     | **Qui** est connecté : email, nom, identifiant, groupes     | 1 heure          |
| **Jeton d'accès** (access)    | **Ce qu'il peut faire** : identifiant, groupes, application | 1 heure          |
| **Jeton de rafraîchissement** | Rien de lisible : une clé pour obtenir de nouveaux jetons   | 30 jours         |

Ces durées se règlent dans l'app client : de 5 minutes à 1 jour pour les deux premiers, de 1 heure à 10 ans pour le troisième.

**Le format JWT.** Les jetons d'identité et d'accès sont des **JWT** (_JSON Web Tokens_), en trois morceaux séparés par des points :

```text
eyJraWQiOi...  .  eyJzdWIiOiI0...  .  kXq3vA...
   en-tête          contenu            signature
```

- **Le contenu** porte des **claims** : `sub` (l'identifiant unique), `email`, `cognito:groups`, `exp` (la date d'expiration), `token_use` (`id` ou `access`)…
- **La signature** est calculée par Cognito avec sa **clé privée**.

Deux conséquences à retenir :

- **Un JWT est signé, pas chiffré.** N'importe qui peut lire son contenu (essayer sur [jwt.io](https://jwt.io)). On n'y met rien de secret.
- **Un JWT ne peut pas être modifié.** S'ajouter le groupe `ADMINS` casserait la signature, que quiconque peut vérifier avec la **clé publique** de Cognito.

**Vérifier une signature, sans demander à Cognito.** Cognito signe avec sa **clé privée**, qui ne le quitte jamais, et publie ses **clés publiques** à une adresse fixe (`https://cognito-idp.<région>.amazonaws.com/<user pool>/.well-known/jwks.json`). L'en-tête du jeton indique quelle clé a servi (`kid`). Celui qui vérifie prend la clé publique correspondante et contrôle que la signature correspond au contenu. C'est la cryptographie asymétrique : seul le détenteur de la clé privée peut signer, tout le monde peut vérifier. **Notre site, lui, ne fait pas cette vérification** (partie 7).

## 7. Comment le site sait si l'on est connecté

### Les jetons sont la session

Le site n'a pas de « session » côté serveur : **la session, ce sont les jetons rangés dans le navigateur.** Pour le site, « j'ai des jetons utilisables » veut dire « l'utilisateur s'est identifié » : seule une vraie connexion, terminée par l'échange PKCE, permet de les obtenir. Il n'existe pas d'autre trace de la connexion.

Amplify les range dans le **`localStorage`**. Le navigateur propose deux stockages, réservés chacun au **seul domaine du site** (un autre site ne peut pas les lire) :

| Stockage                      | Durée de vie                                       | Entre onglets          |
| ----------------------------- | -------------------------------------------------- | ---------------------- |
| **`localStorage`** (le nôtre) | Survit à la fermeture de l'onglet et du navigateur | Partagé                |
| `sessionStorage`              | Effacé à la fermeture de l'onglet                  | Un stockage par onglet |

Avec le `localStorage`, on reste connecté d'un jour à l'autre, jusqu'à 30 jours (la durée du jeton de rafraîchissement), et un nouvel onglet est déjà connecté.

**Pour voir ses jetons** : outils de développement du navigateur, onglet _Application_, puis _Local Storage_ et le domaine du site. Les clés ressemblent à :

```text
CognitoIdentityServiceProvider.<app client>.<utilisateur>.idToken
CognitoIdentityServiceProvider.<app client>.<utilisateur>.accessToken
CognitoIdentityServiceProvider.<app client>.<utilisateur>.refreshToken
CognitoIdentityServiceProvider.<app client>.LastAuthUser
```

Coller le jeton d'identité dans [jwt.io](https://jwt.io) montre son contenu : email, groupes, expiration.

### Qui fait quoi : Amplify et notre code

**Amplify fournit les outils, notre code décide quand s'en servir.** Amplify ne redirige jamais de lui-même vers la page de connexion.

| Qui            | Fait quoi                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Amplify**    | Range et lit les jetons, les renouvelle, **construit et lance** la redirection vers Cognito, **traite le retour** (`?code=`) |
| **Notre code** | **Décide** : au chargement et quand la session est finie, il demande à Amplify de lancer la redirection                      |

L'application ne lit jamais le `localStorage` elle-même : elle passe toujours par deux fonctions d'Amplify.

| Fonction             | Renvoie                                                            | Si personne n'est connecté      |
| -------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `getCurrentUser()`   | Un résumé : identifiant (`userId`), nom d'utilisateur              | Lève une erreur                 |
| `fetchAuthSession()` | Les **jetons** eux-mêmes, avec tous leurs claims (email, groupes…) | Renvoie une session sans jetons |

Les deux lisent **les mêmes jetons**, et peuvent servir l'une après l'autre : à l'ouverture, `getCurrentUser()` dit s'il faut afficher l'application, puis `fetchAuthSession()` fournit l'email affiché dans la barre latérale. Tant que les jetons sont valables, elles ne font aucun appel réseau. On pourrait n'utiliser que `fetchAuthSession()` (« pas de jetons » veut dire « pas connecté ») : `getCurrentUser()` est un raccourci lisible pour la seule question « quelqu'un est-il connecté ? ».

### Quand le contrôle a lieu

Le site est une **application à page unique** (_SPA_) : le navigateur télécharge les fichiers une seule fois, au premier chargement. Passer d'une page à l'autre ne recharge rien : c'est le JavaScript qui change l'affichage. Les fichiers eux-mêmes (HTML, JS, CSS) sont servis par CloudFront **à tout le monde, sans vérification** : ils sont publics.

Le contrôle des jetons a donc lieu à deux moments seulement :

- **au chargement de la page** (ouverture du site, rechargement) : `src/auth/auth-gate.tsx` ;
- **quand l'application a besoin des jetons** (l'email, les groupes) : `fetchAuthSession()`, dans `src/auth/session.ts`.

Dans un site classique, où chaque page est une requête HTTP vers un serveur, le principe serait le même, mais le contrôle reviendrait à chaque chargement de page.

### Au chargement de la page

`src/auth/auth-gate.tsx` enveloppe toute l'application :

```text
Page chargée
 │
 ├─ L'URL contient ?code=... (retour de la page de connexion)
 │    -> Amplify fait l'échange PKCE et range les jetons
 │    -> il émet l'événement « signInWithRedirect » sur son bus d'événements (le Hub)
 │    -> auth-gate.tsx, qui l'écoute, affiche l'application
 │
 └─ Sinon : getCurrentUser()
      ├─ des jetons sont rangés  -> l'application s'affiche
      └─ aucun jeton             -> signInWithRedirect() : Amplify prépare PKCE et state,
                                    puis envoie vers la page de connexion
```

Un cas particulier : un `?code=` déjà utilisé, par un marque-page ou le bouton Précédent, ne mène à aucun échange valide. Le site affiche alors « Connexion impossible » avec un bouton « Réessayer », au lieu de boucler.

### La règle complète

Un jeton d'accès expiré ne renvoie **pas** directement à la page de connexion : Amplify essaie d'abord de le renouveler.

```text
Des jetons rangés dans le localStorage ?
 │
 ├─ non -> page de connexion Cognito
 │
 └─ oui -> le jeton d'accès est-il expiré ?
            ├─ non -> on continue
            └─ oui -> Amplify envoie le jeton de rafraîchissement à Cognito
                       ├─ accepté (moins de 30 jours, non révoqué)
                       │    -> nouveaux jetons d'identité et d'accès, on continue sans rien voir
                       └─ refusé (plus de 30 jours, ou révoqué)
                            -> page de connexion Cognito
```

Le jeton d'accès expire toutes les heures, mais on ne se reconnecte qu'une fois tous les 30 jours au plus, ou après une déconnexion.

### Quand la session est finie

Le jeton de rafraîchissement n'est plus accepté quand :

- **il a expiré** : 30 jours après la connexion ;
- **il a été révoqué** : déconnexion, compte désactivé par un admin.

`fetchAuthSession()` ne renvoie alors plus de jetons, et `src/auth/session.ts` appelle `signInWithRedirect()` : retour à la page de connexion.

**Le site n'est pas prévenu en direct** d'une révocation. Il la découvre au rafraîchissement suivant, donc au plus tard quand le jeton d'accès en cours expire (une heure). Les jetons ne sont jamais « rappelés » : révoquer, c'est empêcher d'en obtenir de nouveaux.

**Le cookie de la page de connexion.** Cognito pose aussi, sur **son propre domaine**, un cookie de session valable une heure. Revenir sur la page de connexion dans l'heure reconnecte sans ressaisir le mot de passe.

### Ce que le site ne vérifie pas

Le site **ne vérifie pas la signature** des jetons. Il fait confiance à ceux qu'il a reçus de Cognito, en HTTPS, et ne regarde que leur date d'expiration (`exp`), pour savoir quand les renouveler.

Quelqu'un pourrait donc écrire de faux jetons dans son propre `localStorage` : le site afficherait l'interface comme s'il était connecté. Ce n'est pas grave à ce niveau : il ne verrait rien de plus que ce que les fichiers publics contiennent déjà (partie 9).

## 8. La déconnexion

Le bouton « Se déconnecter » appelle `signOut()`. Amplify alors :

1. **efface les jetons** du `localStorage` ;
2. **révoque le jeton de rafraîchissement** auprès de Cognito, qui ne pourra plus servir ;
3. **passe par la page de déconnexion de Cognito**, qui efface son cookie d'une heure, puis revient sur le site.

Au retour, le site ne trouve plus de jetons : retour à la page de connexion.

## 9. Ce que le site peut, et ne peut pas, faire

Avec les jetons, le site peut :

- **afficher** l'email, le nom, adapter l'interface aux groupes ;
- **décider** quand renvoyer vers la page de connexion.

Il ne peut pas :

- **protéger des données** : tout ce qui est dans son code ou ses fichiers est public ;
- **empêcher un utilisateur de contourner l'interface** en modifiant le JavaScript.

Sans serveur, la connexion sert donc à **personnaliser l'interface**, pas à **sécuriser des données**.

Les points de vigilance d'un site qui garde des jetons :

- **HTTPS partout**, pour que les jetons ne circulent jamais en clair ;
- **se protéger du XSS** (un script malveillant injecté dans la page pourrait lire le `localStorage`) : c'est le rôle de la **CSP** du site, qui n'autorise que ses propres scripts et les échanges avec Cognito ;
- **des adresses de retour** strictement listées dans l'app client ;
- **des jetons d'accès courts**, pour qu'une fuite ne dure pas.

## 10. Dans ce projet

| Élément                                | Où                                                    |
| -------------------------------------- | ----------------------------------------------------- |
| User pool, app client, Managed Login   | `infra/lib/auth.ts`                                   |
| Configuration d'Amplify                | `src/main.tsx` (identifiants lus dans `/config.json`) |
| Contrôle au chargement, redirection    | `src/auth/auth-gate.tsx`                              |
| Lecture et rafraîchissement des jetons | `src/auth/session.ts`                                 |
| Déconnexion                            | `src/components/app-sidebar.tsx`                      |

Réglages retenus :

- **inscription fermée** : un admin invite, Cognito envoie un mot de passe temporaire à remplacer à la première connexion ;
- **email insensible à la casse** ;
- **connexion uniquement par la page de Cognito** : l'app client n'autorise que le flux par code et le rafraîchissement, aucune connexion directe par mot de passe depuis le site ;
- **durées de jetons par défaut** : 1 heure (identité, accès), 30 jours (rafraîchissement).

## Glossaire

| Terme                 | Sens                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| User pool             | L'annuaire des comptes dans Cognito                                                             |
| App client            | Une application déclarée auprès du user pool, avec ses adresses de retour                       |
| Managed Login         | La page de connexion hébergée par Cognito                                                       |
| OAuth 2.0             | Standard d'autorisation : une application obtient un accès sans voir le mot de passe            |
| OpenID                | Ancien standard d'identité (2005), abandonné ; sans lien technique avec OIDC                    |
| OpenID Connect (OIDC) | Couche d'OAuth 2.0 qui ajoute l'identité : scope `openid`, jeton d'identité, découverte         |
| Scope                 | Permission demandée à la connexion : `openid` (active OpenID Connect), `email`, `profile`       |
| PKCE                  | Secret à usage unique qui prouve que celui qui échange le code l'a demandé                      |
| `code_verifier`       | Le secret de PKCE, gardé dans le navigateur                                                     |
| `code_challenge`      | L'empreinte SHA-256 du secret, envoyée à Cognito au départ                                      |
| `state`               | Valeur aléatoire renvoyée par Cognito, qui garantit que le retour répond à notre demande        |
| JWT                   | Jeton signé, lisible par tous, impossible à modifier sans casser la signature                   |
| Claim                 | Une information portée par un JWT (`sub`, `email`, `cognito:groups`, `exp`…)                    |
| `localStorage`        | Stockage du navigateur propre à un domaine, qui survit à la fermeture : là où vivent les jetons |
| `sessionStorage`      | Stockage du navigateur propre à un domaine et à un onglet, effacé à sa fermeture                |
| SPA                   | Application à page unique : chargée une fois, elle change l'affichage sans recharger de page    |
| Hub                   | Le bus d'événements d'Amplify (connexion réussie, échouée…), que notre code écoute              |
| XSS                   | Injection d'un script malveillant dans une page                                                 |
| CSP                   | Liste des sources qu'une page a le droit de charger ou de contacter                             |
