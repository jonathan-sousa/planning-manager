# À faire

Idées et points ouverts, non triés : l'ordre et les priorités restent à fixer.

## Technique

- **Surveillance et alertes** : alarmes CloudWatch sur les erreurs de l'API, du solveur et de la Lambda des emails, notification par email (SNS) ; budget AWS du projet (filtré sur le tag `Project`) avec alerte au-delà de quelques euros.
- **Test de restauration des sauvegardes** : restaurer un point de sauvegarde de la base de prod dans un cluster temporaire, vérifier les données, écrire la procédure.
- **Rôle de base limité pour l'API** : l'API se connecte en `admin` ; un rôle limité au DML (lecture et écriture des données) lui retirerait le DDL.
- **Intégration continue** : aucune CI ne rejoue `npm run check` et `pytest` sur les PR (une modification de `.github/workflows/` se décide avec Jonathan).
- **Réinitialisation du MFA** : à vérifier de bout en bout sur un second compte réel.
- **Journaux du WAF** : absents, car le forfait CloudFront Free ne les autorise qu'en `us-east-1` ; à reconsidérer si l'hôpital accepte ce stockage ou si le forfait change.

## Produit

- **Guide d'utilisation pour les cadres** : créer un mois, saisir, lancer le solveur, valider, publier, exporter, gérer les comptes et le MFA.
- **Format du CSV** : à adapter au format d'import de l'outil de gestion des temps de l'hôpital, une fois connu.
- **Postes** : un agent peut-il avoir deux postes le même jour ?

## Avec l'hôpital

- **Gouvernance** : accord de la DSI et du DPO avant toute donnée nominative réelle (hébergement de données de santé, AWS région Paris). En attendant, données fictives uniquement.
- **Interprétations du validateur** à valider avec le cadre de santé : voir [scheduling-rules.md](scheduling-rules.md#interprétations-à-valider) (repos de 36h glissant, absences comptées comme repos dans la quinzaine, mois voisin vide, cible d'heures).
- **Protocole temps de travail local** :
  - dérogation 12h ;
  - nombre maximal de jours consécutifs ;
  - statut du lendemain de nuit (repos ou non) ;
  - ancrage des quinzaines ;
  - régimes horaires ;
  - codes d'absence.
- **Horaires exacts** des postes et besoins par grade.
- **Mise en service** : désigner un second admin (un téléphone perdu ne doit bloquer personne), inviter les cadres.
