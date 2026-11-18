# Xolbor Ultimate — architecture et phases

## Décision avant développement — 4 novembre 2026

La source retenue est la version imbriquée du dépôt existant, avec ses modifications Stripe. Une copie autonome est créée ; les dossiers originaux ne sont jamais modifiés. Aucun compte, message privé ou secret n'est inclus dans le dossier livrable. Les statistiques du catalogue neuf repartent à zéro ; une migration explicite conserve les vraies statistiques du site existant.

Stack conservée : HTML/JavaScript, Express, Socket.IO, bcrypt et Three.js local. Le remplacement par React n'apporterait pas de bénéfice immédiat à la sécurisation. Les jeux et l'installateur Studio existants sont conservés. L'exécutable Studio n'est pas son code source et ne constitue pas un éditeur web développé.

## Phase 1 : fondations et tranche fonctionnelle

- API existante conservée avec routes sensibles remplacées par des modules vérifiés.
- SQLite transactionnel (Node 24.12+), tables utilisateurs, sessions, documents de compatibilité, historique monétaire et messages de salon. Les champs historiques restent dans des documents JSON pour éviter une migration destructive. Ce n'est pas encore le modèle relationnel final.
- Sessions opaques hachées en base, cookie HttpOnly/SameSite, expiration et révocation. Aucun secret de session dans localStorage.
- Fichiers publics explicitement autorisés, contrôle d'origine, validation, limites HTTP et WebSocket.
- Achats au prix serveur ; aucune route de crédit libre. Paiements réels et tournois rémunérés suspendus jusqu'au registre de paiements/webhooks et aux scores vérifiés.
- Lobby Three.js accessible avec le même compte, salons publics/privés, capacité bornée, commandes de déplacement traitées à fréquence fixe par le serveur, chat persistant borné, reconnexion.
- Personnage anime original exporté en GLB, squelette humanoïde simple et animations Idle/Walk ; couleurs et tenues enregistrées sur le compte. Pas de retargeting universel.
- Tests de migrations, sécurité HTTP, identité Socket.IO, isolation des salons, autorité des mouvements et persistance.

SQLite convient à une première instance autonome sans abonnement à un service. Une seule instance Node doit écrire dans cette base ; aucun partage réseau ni promesse de milliers de joueurs. Avant plusieurs machines : PostgreSQL, tables normalisées, Redis pour présence/adaptateur Socket.IO, services de simulation isolés et tests de charge. Les salons du prototype tournent dans le processus Node, pas dans des serveurs dédiés isolés.

## Phases suivantes (non livrées par cette phase)

2. Comptes : vérification email, récupération de mot de passe, consentement/âge, restrictions de contacts, blocages et signalements complets, rôles et interface d'administration.
3. Avatars/assets : GLB/GLTF/FBX, analyse en quarantaine, stockage objet, droits/licences, API officielle Sketchfab, import Mixamo autorisé, rig humanoïde et retargeting.
4. Économie : tables d'inventaire normalisées, idempotence de commandes, webhooks signés Stripe/PayPal, remboursements, rémunération des créateurs et protection des mineurs.
5. Jeu : serveurs dédiés, matchs et groupes, reconnection avec réservation, reconnexion inter-machine, surveillance et déploiement multi-région.
6. Studio web : éditeur, versions, stockage, scripts isolés, validation et publication modérée.
7. Communautés, notifications persistantes, missions et saisons fondées sur des événements serveur vérifiés.

## Préparation du déploiement

Conserver xolbor.ma et le reverse proxy HTTPS. Déployer d'abord sur une instance de recette et importer une copie de sauvegarde hors ligne. Ne jamais écraser la base active. Un disque persistant est obligatoire. Les fichiers SQLite, données historiques et sauvegardes ne sont jamais publiés statiquement. La publication et les DNS de production ne sont pas modifiés par cette livraison.

Références techniques : https://nodejs.org/download/release/v24.12.0/docs/api/sqlite.html ; https://socket.io/docs/v4/middlewares/ ; https://threejs.org/docs/.
