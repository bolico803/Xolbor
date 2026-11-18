# Recharges Xubor — test local uniquement

Il n'est pas encore possible d'acheter des Xubor avec de l'argent réel. Le mode de test Stripe est désactivé par défaut et reste indisponible quand NODE_ENV=production. Le test peut créer une commande Stripe de test et créditer une base locale de test après réception d'un webhook authentifié ; il ne valide pas la mise en production.

Les prix historiques sont des valeurs de test, pas des offres publiées. Aucun numéro de carte ne passe par Xolbor : le formulaire de paiement est hébergé par Stripe. Le compte Xolbor doit être connecté.

## Configuration du test

1. Créer un compte Stripe et ouvrir le Dashboard développeur en mode test. Obtenir la clé API secrète de test, qui commence par `sk_test_` : https://docs.stripe.com/keys. Ne jamais la coller dans une discussion ou dans le dépôt.
2. Installer Stripe CLI depuis https://docs.stripe.com/stripe-cli et se connecter à son compte de test.
3. Dans un terminal, démarrer le relais de test :

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to http://127.0.0.1:5897/api/payments/stripe/webhook
```

4. Stripe CLI affiche un secret de signature `whsec_...`. Dans le fichier local `.env` ignoré par Git, définir `NODE_ENV=development`, `XUBOR_TEST_PAYMENTS=1`, `STRIPE_SECRET_KEY` avec la clé de test et `STRIPE_WEBHOOK_SECRET` avec ce secret. Ne pas utiliser de clés `sk_live_`.
5. Redémarrer Xolbor, se connecter avec un compte de test, ouvrir `/hub#wallet`, sélectionner un pack marqué TEST et suivre le paiement hébergé. Utiliser uniquement les moyens de paiement de test décrits par Stripe : https://docs.stripe.com/testing. Le navigateur revient au portefeuille ; l'ajout ne se produit qu'à réception du webhook vérifié. Actualiser pour voir le solde si nécessaire.
6. Désactiver `XUBOR_TEST_PAYMENTS` et supprimer la base de test isolée lorsque le test est terminé. Ne pas utiliser les soldes de test comme données de production.

Le serveur vérifie la signature, le mode de test, l'ID de commande, l'ID de session, l'utilisateur, le montant, la monnaie et l'état payé. Le crédit et le journal sont effectués dans une transaction SQLite et ne sont pas doublés lors de la retransmission du même webhook. Les essais automatisés couvrent des événements simulés signés ; une vraie session Stripe n'a pas été exécutée sans tes identifiants de test.

Avant un lancement réel, il faut notamment gérer la réconciliation des commandes et webhooks manqués, les remboursements partiels, litiges et rétrofacturations, l'assistance, la protection des mineurs, les obligations fiscales et les tests de production. Le code actuel refuse le mode réel et ne doit pas être modifié pour l'activer sans réaliser ces travaux.
