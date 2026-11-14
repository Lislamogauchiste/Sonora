# SONORA

Une plateforme personnelle de stockage et d'écoute musicale dans le navigateur.

## Fonctionnalités actuelles
- Import de fichiers audio locaux (MP3, WAV, FLAC, M4A, OGG, AAC selon le navigateur).
- Bibliothèque persistante dans IndexedDB du navigateur.
- Recherche dans les titres, artistes et albums.
- Lecteur audio avec lecture/pause, précédent/suivant, progression et volume.
- Lecture aléatoire et répétition.
- Création de playlists (structure locale initiale).

## Lancer le projet
Aucune compilation n'est nécessaire : ouvre `index.html` dans un navigateur ou active GitHub Pages sur la branche `main`, dossier `/ (root)`.

## Stockage et confidentialité
Les fichiers audio sont conservés dans le stockage local du navigateur sur l'appareil utilisé. Ils ne sont pas envoyés vers GitHub ni vers un serveur. Effacer les données du site ou utiliser un autre navigateur/appareil peut rendre cette bibliothèque inaccessible.

## Limites de cette première version
Il s'agit d'une application front-end locale : il n'y a pas encore de comptes utilisateurs, de synchronisation multi-appareils ni de stockage cloud. Les playlists sont sauvegardées localement.