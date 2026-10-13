// connexio_firebase.js — claus del projecte Firebase on es desa el progrés dels alumnes.
// COM OMPLIR-HO: segueix FIREBASE_COM_CONFIGURAR.md (en aquesta mateixa carpeta).
// Mentre això sigui null, el mapa funciona igual però el progrés només queda al navegador
// de cada alumne i el panell docent no té dades.
//
// Aquestes claus NO són secretes (identifiquen el projecte, no hi donen permisos:
// els permisos els posen les "regles" del Firestore). Es publiquen amb la web.
window.FIREBASE_CONFIG = null;

// Quan tinguis el projecte creat, esborra la línia de dalt i descomenta això
// amb els valors que et doni Firebase (només calen aquests dos):
// window.FIREBASE_CONFIG = {
//   apiKey: 'AIzaSy...',
//   projectId: 'estat-solid-uab',
// };
