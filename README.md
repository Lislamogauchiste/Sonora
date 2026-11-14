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

## Importer de playlists depuis d'autres services
Dans SONORA, clique sur **Importer une playlist** et sélectionne un export de playlist au format CSV, JSON ou M3U/M3U8. Ces formats peuvent être générés par des outils de transfert/export de playlists (par exemple Soundiiz ou TuneMyMusic), ou par certains services musicaux.
L'import récupère les métadonnées (titre, artiste, album) et crée une playlist SONORA. Les morceaux déjà présents dans la bibliothèque locale sont associés automatiquement. Pour écouter les autres, il faut ajouter les fichiers audio correspondants que tu possèdes ou que tu es autorisé à utiliser.
SONORA ne se connecte pas directement aux comptes Spotify, Deezer ou Apple Music et ne copie pas les flux audio protégés par DRM. L'import de playlist ne transfère donc pas les abonnements ni les fichiers audio des services d'origine.


## Recherche et import depuis des plateformes musicales
- Recherche de titres dans les catalogues Apple/iTunes et Deezer depuis le bloc « Explorer la musique en ligne ».
- Ajout des références trouvées à la playlist locale « Titres repérés en ligne » et ouverture de la fiche sur la plateforme d'origine.
- Aperçus audio Deezer de courte durée lorsqu'ils sont fournis par le catalogue.
- Import d'une playlist Deezer publique en collant son URL.
- Pour Spotify et Apple Music, utiliser un export CSV, JSON ou M3U depuis un outil de transfert compatible puis l'importer dans SONORA. L'import par URL et la copie de flux audio protégés ne sont pas pris en charge.
- La recherche Deezer utilise un service proxy public pour contourner la restriction CORS de son API ; sa disponibilité dépend de ce service tiers.
