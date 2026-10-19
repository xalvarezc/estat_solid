// temes.js — dades compartides dels temes del curs: icona i simuladors de cada tema.
// Les fan servir l'índex de simuladors (simuladors/index.html) i la portada del curs.
// Per afegir un simulador, afegeix-lo aquí: les dues pàgines s'actualitzen soles.

// Una icona SVG senzilla (línia, sense reblir extern) per a cada tema —
// mateix llenguatge visual que la resta del lloc (traç currentColor, sense
// llibreries externes). Es reutilitzen igual a la capçalera de cada pàgina
// de simulador del tema corresponent.
var ICONES = {
  "00": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 19 L3 6 L8 6 M21 19 L21 6 L16 6" stroke-width="1.8"/><path d="M3 19 L21 19" stroke-width="1.2" opacity=".5"/><path d="M5 13 Q8 7 11 13 T17 13" stroke-width="1.6"/></svg>`,
  "01": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M3 19 L9 19 L15 19 M5 13 L11 13 L17 13 M7 7 L13 7 L19 7" opacity=".55"/><path d="M3 19 L5 13 L7 7 M9 19 L11 13 L13 7 M15 19 L17 13 L19 7" opacity=".55"/><circle cx="3" cy="19" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  "02": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9" stroke-dasharray="1.5 2" opacity=".4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.7" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7.7" r="1.3" fill="currentColor" stroke="none"/><circle cx="7" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="16.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="16.3" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  "03": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="12" r="4" opacity=".85"/><circle cx="17.5" cy="12" r="4" opacity=".85"/><path d="M10.5 12 L11.5 9 L13 15 L13.5 12"/></svg>`,
  "04": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 L6 16 L7 18 L9 10" opacity=".8"/><path d="M9 10 L11 18 L12 16 L15 20" opacity=".8"/><path d="M15 20 L18 17 L19 19 L21 17" opacity=".8"/><circle cx="3" cy="17" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="20" r="1.6" fill="currentColor" stroke="none"/><circle cx="21" cy="17" r="1.6" fill="currentColor" stroke="none"/></svg>`,
  "05": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12 C4.5 4, 7.5 4, 10 12 C12.5 20, 15.5 20, 18 12 C19.5 7.5, 21 7.5, 22 10.5"/></svg>`,
  "06": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`,
  "07": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 19 Q12 15 22 19" stroke-width="2.6"/><path d="M2 8 Q12 4 22 8" stroke-width="2.6"/><path d="M12 15 L12 8" stroke-width="1" stroke-dasharray="1.5 1.8" opacity=".5"/></svg>`,
  "08": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2.5" y="4" width="19" height="16" rx="1.5"/><line x1="12" y1="4" x2="12" y2="20" stroke-dasharray="1.6 1.6"/><path d="M6 10 h4 M8 8 v4" stroke-width="1.4"/><path d="M6 16 h4" stroke-width="1.4"/><path d="M16 10 h4" stroke-width="1.4"/><path d="M16 16 h4" stroke-width="1.4"/></svg>`
};

var TEMES = [
  {num:"00", nom:"Repàs de quàntica", etiqueta:"REPÀS", carpeta:"00_repas_quantica", simuladors:[
    {nom:"Electró lliure en un pou de potencial finit", href:"00_repas_quantica/pou_finit.html",
     desc:"Resol l'equació de Schrödinger per a un pou rectangular de profunditat finita — tria l'amplada, la profunditat i el nombre de nodes de ψ(x), i compara amb el límit de parets dures."}
  ]},
  {num:"01", nom:"Xarxes cristal·lines", carpeta:"01_xarxes_cristalines", simuladors:[
    {nom:"Xarxes de Bravais i difracció", href:"01_xarxes_cristalines/bravais_difraccio.html",
     desc:"Construeix una xarxa 2D (vectors primitius, base de dos àtoms), activa la cel·la convencional i la de Wigner-Seitz, i explora els plans de Miller a l'espai recíproc i les operacions de simetria."},
    {nom:"Grups puntuals dels 7 sistemes cristal·lins", href:"01_xarxes_cristalines/simetria_3d.html",
     desc:"Tria un sistema cristal·lí (Ci, C2h, D2h, D4h, D3d, D6h, Oh) i veuràs la seva cel·la; el mateix menú de 46 operacions candidates es colora en verd o vermell segons si són o no una simetria real d'aquell cristall, i el lliscador interpola de la identitat a l'operació completa."}
  ]},
  {num:"02", nom:"Xarxa recíproca / difracció", carpeta:"02_xarxa_reciproca_difraccio", simuladors:[
    {nom:"Funcions periòdiques i xarxa recíproca: de la sèrie de Fourier a exp(iG·T) = 1", href:"02_xarxa_reciproca_difraccio/fourier_xarxa.html",
     desc:"En 1D, una funció de període a es descompon en ones de període a, a/2, a/3…, les úniques amb exp(iqa) = 1. En 2D, el mateix argument porta a les ones e^(iG·r) amb G de la xarxa recíproca: canvia la xarxa, la funció i el nombre de termes, i prova ones que no en són."},
    {nom:"La condició de Bragg — dos plans, una interferència", href:"02_xarxa_reciproca_difraccio/bragg_interferencia.html",
     desc:"Dos rajos reboten en dos plans consecutius separats per d; mou l'angle d'observació i veges en directe si arriben en fase (constructiva) o en oposició de fase (destructiva)."},
    {nom:"Difracció de pols — de la cel·la unitat als pics", href:"02_xarxa_reciproca_difraccio/difraccio_pols.html",
     desc:"Tria un sistema cristal·logràfic i un centratge de Bravais, dóna a, b, c i els angles, i calcula el patró de difracció de pols (2θ i multiplicitat) per a una base d'un sol àtom."},
    {nom:"La condició de Laue i la difracció de pols: girar el cristall", href:"02_xarxa_reciproca_difraccio/ewald_pols.html",
     desc:"Cristall 2D i λ fixa: gira el cristall i l'observador i mira a la vegada el laboratori i la construcció d'Ewald. Hi ha pic quan la punta de k′ toca un G; girant el cristall 360°, cada circumferència de gir dels G talla la de l'observador i apareixen els anells de pols."},
    {nom:"De la cúbica simple a BCC, FCC i diamant: pics que desapareixen", href:"02_xarxa_reciproca_difraccio/extincions_cubiques.html",
     desc:"Mateixa cel·la cúbica, bases diferents: fes créixer el pes dels àtoms afegits i mira com el factor d'estructura apaga, per interferència, els pics de la cúbica simple fins a arribar a la BCC, la FCC o el diamant."},
    {nom:"Amplitud dispersada: suma sobre la xarxa, factor d'estructura i factor de forma", href:"02_xarxa_reciproca_difraccio/factors_difraccio.html",
     desc:"Cristall 2D amb base de fins a dos àtoms: mapa de |F|², |L|², |S|² o |f|² sobre el pla de Δk, i per al Δk que triïs, la suma de fasors de cada terme. Mostra per què només hi ha pics a Δk = G i per què algunes reflexions queden prohibides."},
    {nom:"El mètode de Laue — cristall fix, feix policromàtic", href:"02_xarxa_reciproca_difraccio/laue.html",
     desc:"Cristall cúbic amb orientació fixa ([100], [110] o [111]) i un feix blanc: cada (hkl) tria la seva pròpia λ i produeix una taca sobre la pel·lícula — així ho va fer von Laue el 1912."}
  ]},
  {num:"03", nom:"Cohesió", carpeta:"03_cohesio", simuladors:[
    {nom:"La corba de cohesió i el mòdul de compressibilitat", href:"03_cohesio/corba_cohesio.html",
     desc:"Tres mecanismes d'enllaç (van der Waals, iònic i covalent) i una sola corba e(r): el mínim dona el paràmetre de xarxa i l'energia de cohesió, i la corbatura, B = e″(r₀)/(9 g r₀). Comprimeix el cristall i mira la pressió, i compara la rigidesa predita amb l'experimental per a una dotzena de materials."},
    {nom:"Polaritzabilitat: un àtom dins d'un camp elèctric", href:"03_cohesio/polaritzabilitat.html",
     desc:"El núvol electrònic, lligat al nucli per una molla, es desplaça en sentit contrari al camp fins que eE = Cx: apareix un dipol μ = αE que apunta com el camp. Gira i canvia el camp, compara l'heli amb el xenó i mira per què calen camps d'1 V/Å per deformar visiblement un àtom."},
    {nom:"Forces de London: dos dipols que fluctuen", href:"03_cohesio/forces_london.html",
     desc:"Dos oscil·ladors de Drude acoblats: l'acoblament dipol-dipol separa les freqüències dels dos modes i l'energia de punt zero baixa com −A/R⁶. Mostres de l'estat fonamental que fan visible la correlació entre els dos dipols."},
    {nom:"Del parell al cristall: sumes de xarxa de Lennard-Jones", href:"03_cohesio/sumes_xarxa.html",
     desc:"Suma capa a capa del potencial de Lennard-Jones per a SC, BCC, FCC i HCP: A₁₂, A₆, r₀ = 1.090 σ, e₀ = −8.61 ε i B = 75 ε/σ³ per a la FCC, i per què la FCC i la HCP gairebé empaten."},
    {nom:"La constant de Madelung: l'ordre de la suma importa", href:"03_cohesio/madelung.html",
     desc:"Cadena 1D (2 ln 2), NaCl i CsCl: sumant per capes esfèriques la sèrie no s'estabilitza; sumant per blocs neutres (Evjen) convergeix a 1.7476 i 1.7627. Mostra per què una suma condicionalment convergent depèn de com s'ordena."},
    {nom:"L'enllaç covalent mínim: l'ió H₂⁺", href:"03_cohesio/enllac_covalent.html",
     desc:"Model LCAO amb les integrals exactes S, J i K: corbes d'energia dels estats enllaçant i antienllaçant, diagrama de nivells, i mapes de densitat que mostren com la càrrega s'acumula entre els protons quan es forma l'enllaç."},
    {nom:"Laboratori d'elasticitat: estira, colpeja i trenca un cristall", href:"03_cohesio/laboratori_elasticitat.html",
     desc:"Un cristall 2D de milers d'àtoms units per enllaços de Morse, simulat en temps real. Assaig de tracció fins a la ruptura amb la corba tensió-deformació en directe (E i ν mesurats), cisallament, cops de martell amb ones P i S, i defectes: la tensió es concentra al voltant d'un forat i una esquerda fa trencar el cristall abans."},
    {nom:"Elasticitat d'un cristall cúbic: llei de Hooke i ones elàstiques", href:"03_cohesio/ones_elastiques.html",
     desc:"Constants C₁₁, C₁₂ i C₄₄ de materials reals: deforma un cub i mira les tensions, calcula B, G, E i ν, i fes viatjar ones en qualsevol direcció (equació de Christoffel) per veure com l'anisotropia canvia la velocitat del so."}
  ]},
  {num:"04", nom:"Dinàmica de xarxa", carpeta:"04_dinamica_xarxa", simuladors:[
    {nom:"La cadena monoatòmica: modes normals, relació de dispersió i zona de Brillouin", href:"04_dinamica_xarxa/cadena_monoatomica.html",
     desc:"Àtoms idèntics units per molles (plans (100) de coure o alumini, o unitats reduïdes). Tria q i mira la cadena, el punt sobre ω(q) i les velocitats de fase i de grup; surt de la primera zona i comprova que els àtoms fan el mateix; afegeix molles amb segons i tercers veïns i recupera les constants de força amb la integral de Fourier."},
    {nom:"La cadena diatòmica: branques acústica i òptica", href:"04_dinamica_xarxa/cadena_diatomica.html",
     desc:"Dos àtoms per cel·la amb masses M₁, M₂ i molles alternes C, D: les dues branques, com es mou cada àtom (en fase o en oposició, centre de masses quiet), el buit de freqüències en funció de les masses o de les molles, el plegament de la zona quan els àtoms són iguals, i el NaCl amb la molla ajustada a l'infraroig."},
    {nom:"Paquet d'ona: velocitat de fase i velocitat de grup", href:"04_dinamica_xarxa/paquet_ona.html",
     desc:"Tria una relació de dispersió (cadena monoatòmica, branques acústica i òptica, o sense dispersió), k₀ i Δk, i mira el paquet avançar: les crestes a ω/k, l'envolvent a Δω/Δk ≈ dω/dk, amb Δx·Δk ≈ 1 i el diagrama x–t."},
    {nom:"La matriu dinàmica en 3D: branques acústiques i òptiques d'un cristall real", href:"04_dinamica_xarxa/fonons_3d.html",
     desc:"SC, BCC, FCC, CsCl, NaCl i diamant amb molles centrals entre primers i segons veïns ajustades a materials reals (Cu, Al, W, Fe, NaCl, C, Si). Construeix i diagonalitza D(q) al llarg de la zona de Brillouin, mostra la matriu i la cel·la amb les molles, classifica els modes (L/T, acústic/òptic) i en treu C₁₁, C₁₂ i C₄₄ per comparar amb l'experiment."}
  ]},
  {num:"05", nom:"Fonons", carpeta:"05_fonons", simuladors:[
    {nom:"La calor específica d'un cristall: fonons, Einstein i Debye", href:"05_fonons/calor_especifica.html",
     desc:"Densitat d'estats de nou materials reals (diamant, Si, Ge, Cu, Al, W, NaCl, Ar, c-BN), calculada amb la dinàmica de xarxa del Tema 4: quins modes estan actius a cada temperatura (Planck), la calor específica que en surt, i com la reprodueixen els models d'Einstein i de Debye, des de la llei T³ fins a Dulong-Petit."},
    {nom:"La conductivitat tèrmica d'un aïllant: el recorregut lliure mitjà dels fonons", href:"05_fonons/conductivitat_termica.html",
     desc:"K = ⅓ C v ℓ amb el recorregut lliure mitjà de cada fonó limitat per les vores de la mostra, el desordre isotòpic i els xocs umklapp: la corba K(T) amb el seu màxim, l'efecte de la mida (de nanofils a cristalls) i dels isòtops, i quins fonons porten de debò la calor."}
  ]},
  {num:"06", nom:"Fermi / electrons", carpeta:"06_fermi_electrons", simuladors:[
    {nom:"Sommerfeld: g(ε), f_FD(ε,T) i el desplaçament de μ", href:"06_fermi_electrons/simulador_sommerfeld.html",
     desc:"Control de temperatura en directe; mostra com μ es desplaça per sota de ε_F."},
    {nom:"Densitat d'estats en 1D, 2D i 3D", href:"06_fermi_electrons/densitat_estats_dimensions.html",
     desc:"Per què g(ε) divergeix, és constant o creix segons la dimensió — l'argument geomètric perímetre×dk/dε."},
    {nom:"Model de Drude clàssic", href:"06_fermi_electrons/drude_classic.html",
     desc:"Electrons amb dispersió i estadística de Maxwell-Boltzmann, sota camps E i B — el model original de Drude, previ a l'estadística quàntica."},
    {nom:"Model de Drude-Fermi", href:"06_fermi_electrons/drude_fermi.html",
     desc:"El mateix model amb estadística de Fermi-Dirac — compara-ho amb el clàssic per veure què hi aporta la mecànica quàntica."}
  ]},
  {num:"07", nom:"Bloch / bandes", carpeta:"07_bloch_bandes", simuladors:[
    {nom:"Combinació d'ones planes — estats de Bloch", href:"07_bloch_bandes/bloch_ones_planes.html",
     desc:"Mètode de l'electró quasi lliure: diagonalitza el hamiltonià en la base d'ones planes i mostra com s'obren els gaps de banda. Inclou activitats guiades pas a pas."}
  ]},
  {num:"08", nom:"Semiconductors", carpeta:"08_semiconductors", simuladors:[
    {nom:"Unió PN — regió de buidament", href:"08_semiconductors/unio_pn.html",
     desc:"Unió abrupta p-n en equilibri: dopatge, portadors, densitat de càrrega, camp elèctric i potencial, els cinc compartint el mateix eix x. Inclou descàrrega de dades en CSV."}
  ]}
];
