// mapa_dades.js — contingut del mapa conceptual del curs.
//
// Estructura: línies argumentals → estacions (blocs dels apunts) → conceptes.
// Cada concepte:
//   id     identificador estable (el fa servir el progrés desat de l'alumne: no el canviïs)
//   nom    títol curt
//   desc   què ha d'entendre l'alumne, en una o dues frases
//   sec    número de secció dels apunts del tema ('2.4'), si n'hi ha
//   ap     ancora de la secció als apunts web ('sec:lj'), si el tema té apunts web
//   sims   simuladors relacionats (ruta dins de web_simuladors/)
//   cal    conceptes que cal haver entès abans (poden ser d'una altra línia)
//   veure  conceptes relacionats que no són prerequisits
//   ref    on es tracta al llibre de referència (Kittel), sobretot si encara no és als apunts
//   ex     exercicis del full del tema que el practiquen ('3.5'); els títols i els enllaços
//          surten de mapa_exercicis.js, que genera web_apunts/construeix.py --exercicis
// El tema de cada concepte és el de la seva estació.

// Temes que ja tenen apunts web (carpeta dins de web_apunts/). Quan se'n publiqui un de nou, afegeix-lo aquí.
var APUNTS_WEB = {
  '01': '01_xarxes_cristallines',
  '02': '02_xarxa_reciproca',
  '03': '03_cohesio',
  '04': '04_dinamica_xarxa',
  '05': '05_fonons'
};

var NOMS_TEMES = {
  '00': 'Repàs', '01': 'Xarxes cristal·lines', '02': 'Xarxa recíproca i difracció', '03': 'Cohesió',
  '04': 'Dinàmica de xarxa', '05': 'Fonons', '06': 'Electrons lliures', '07': 'Bloch i bandes', '08': 'Semiconductors'
};

var MAPA = { linies: [

  { id: 'T', nom: 'Eines prèvies', curt: 'Eines', color: '#6B7280', temes: 'Repàs',
    desc: 'El que es fa servir sense tornar-ho a explicar: mecànica, quàntica i física estadística dels cursos anteriors.',
    estacions: [
      { id: 'T1', nom: 'Oscil·lador clàssic', curt: 'Oscil·lador', tema: '00', conceptes: [
        { id: 't_oscil', nom: 'Oscil·lador harmònic clàssic i modes normals',
          desc: 'Una massa amb una molla oscil·la amb ω = √(C/m). Dos oscil·ladors acoblats es descomponen en modes normals independents.' } ] },
      { id: 'T2', nom: 'Oscil·lador quàntic', curt: 'Osc. quàntic', tema: '00', conceptes: [
        { id: 't_oscil_q', nom: 'Oscil·lador harmònic quàntic',
          desc: 'Els nivells d\'energia ħω(n + ½) i l\'energia de punt zero, ½ħω, que no es pot treure.' } ] },
      { id: 'T3', nom: 'Equació de Schrödinger', curt: 'Schrödinger', tema: '00', conceptes: [
        { id: 't_schrodinger', ex: ['3.1'], nom: 'Equació de Schrödinger: partícula lliure i pou',
          desc: 'Ones planes per a una partícula lliure, i com les condicions de contorn d\'un pou quantitzen l\'energia.',
          sims: ['00_repas_quantica/pou_finit.html'] } ] },
      { id: 'T4', nom: 'Física estadística', curt: 'Estadística', tema: '00', conceptes: [
        { id: 't_stat', nom: 'Boltzmann, equipartició, bosons i fermions',
          desc: 'El factor de Boltzmann e^(−E/kT), l\'equipartició (½kT per cada terme quadràtic de l\'energia) i la diferència entre bosons i fermions.' } ] }
    ] },

  { id: 'P', nom: 'Periodicitat i espai recíproc', curt: 'Periodicitat', color: '#2B6CB0', temes: 'Temes 1–2',
    desc: 'Com es descriu l\'ordre d\'un cristall, i com aquest ordre es tradueix a l\'espai recíproc, on es llegeix la difracció.',
    estacions: [
      { id: 'P1', nom: 'La xarxa de Bravais', curt: 'Xarxa de Bravais', tema: '01', conceptes: [
        { id: 'p_bravais', ex: ['1.1', '1.3', '1.4'], nom: 'Xarxa de Bravais i vectors primitius', sec: '1', ap: 's1',
          desc: 'Un conjunt infinit de punts R = n₁a₁ + n₂a₂ + n₃a₃ que es veu exactament igual des de qualsevol dels seus punts. Els vectors primitius no són únics, però tots generen la mateixa xarxa.',
          sims: ['01_xarxes_cristalines/bravais_difraccio.html'] },
        { id: 'p_cella', ex: ['1.13', '1.15', '2.8'], nom: 'Cel·la primitiva, convencional i de Wigner-Seitz', sec: '1.1', ap: 's1-1', cal: ['p_bravais'],
          desc: 'Cel·les que, repetides amb les translacions de la xarxa, omplen l\'espai sense forats ni solapaments. La de Wigner-Seitz és la regió més propera a un punt de xarxa que a cap altre.',
          sims: ['01_xarxes_cristalines/bravais_difraccio.html'] } ] },
      { id: 'P2', nom: 'Simetria', curt: 'Simetria', tema: '01', conceptes: [
        { id: 'p_simetries', ex: ['1.11', '1.12', '1.14', '1.16'], nom: 'Rotacions compatibles amb la translació', sec: '2', ap: 'sec:simetries', cal: ['p_bravais'],
          desc: 'Per què una xarxa periòdica només pot tenir eixos de rotació d\'ordre 1, 2, 3, 4 i 6, i mai de 5.',
          sims: ['01_xarxes_cristalines/simetria_3d.html'] },
        { id: 'p_sistemes', ex: ['1.14'], nom: 'Els set sistemes cristal·lins', sec: '3.3', ap: 's3-3', cal: ['p_simetries'],
          desc: 'Com les simetries de rotació permeses classifiquen les xarxes en 3D en set sistemes, del triclínic al cúbic.',
          sims: ['01_xarxes_cristalines/simetria_3d.html'] },
        { id: 'p_xarxes', ex: ['1.2', '1.3', '1.4'], nom: 'Les xarxes de Bravais en 1D, 2D i 3D', sec: '3', ap: 's3', cal: ['p_bravais', 'p_sistemes'],
          desc: 'Per què n\'hi ha una en 1D, cinc en 2D i catorze en 3D, i com es reconeixen les centrades, com la BCC i la FCC.' } ] },
      { id: 'P3', nom: 'Cristall = xarxa + base', curt: 'Xarxa + base', tema: '01', conceptes: [
        { id: 'p_base', ex: ['1.5', '1.16', '2.1', '2.8'], nom: 'Base atòmica: cristall = xarxa + base', sec: '4', ap: 'sec:base', cal: ['p_bravais'],
          desc: 'Un cristall real s\'obté posant el mateix grup d\'àtoms, la base, a cada punt de la xarxa. La xarxa diu com es repeteix; la base, què es repeteix.' },
        { id: 'p_estructures', ex: ['1.5', '1.6', '1.8', '2.1'], nom: 'Estructures reals: FCC, BCC, NaCl, CsCl, diamant', sec: '4', ap: 'sec:base', cal: ['p_base', 'p_xarxes'],
          desc: 'Reconèixer la xarxa i la base de les estructures que surten a tot el curs.' },
        { id: 'p_densitat', ex: ['1.7', '1.8', '2.9'], nom: 'Densitat i fracció d\'ocupació', sec: '5.1', ap: 's5-1', cal: ['p_estructures'],
          desc: 'Comptar els àtoms d\'una cel·la per calcular la densitat numèrica i la màssica, i quina fracció de l\'espai omplen esferes en contacte.' },
        { id: 'p_plans', ex: ['1.9', '1.10'], nom: 'Plans cristal·logràfics i índexs de Miller', sec: '5.2', ap: 's5-2', cal: ['p_bravais'],
          desc: 'Com s\'anomenen els plans (hkl), quina distància hi ha entre plans paral·lels i quants àtoms hi ha per unitat de superfície.',
          sims: ['01_xarxes_cristalines/bravais_difraccio.html'] } ] },
      { id: 'P4', nom: 'Fourier i xarxa recíproca', curt: 'Xarxa recíproca', tema: '02', conceptes: [
        { id: 'p_fourier', nom: 'Sèries de Fourier d\'una funció periòdica', sec: '1', ap: 's1',
          desc: 'Qualsevol funció amb el període de la xarxa s\'escriu com una suma d\'ones planes. La condició de realitat lliga els coeficients de G i de −G.' },
        { id: 'p_reciproca', ex: ['2.2', '2.3', '2.4', '2.8'], nom: 'La xarxa recíproca', sec: '2', ap: 'sec:reciproca', cal: ['p_fourier', 'p_bravais'],
          desc: 'Els vectors G que compleixen e^(iG·R) = 1 per a tots els R de la xarxa. Formen una xarxa de Bravais, amb vectors primitius que compleixen aᵢ·bⱼ = 2πδᵢⱼ.',
          sims: ['01_xarxes_cristalines/bravais_difraccio.html'] },
        { id: 'p_fourier_xarxa', nom: 'Sèrie de Fourier sobre la xarxa recíproca', sec: '2.1', ap: 's2-1', cal: ['p_reciproca'],
          desc: 'Una funció amb la periodicitat del cristall (la densitat electrònica, el potencial) només té components de Fourier als vectors G. La idea torna a la difracció i al teorema de Bloch.' } ] },
      { id: 'P5', nom: 'Difracció', curt: 'Difracció', tema: '02', conceptes: [
        { id: 'p_amplitud', nom: 'Amplitud dispersada per un cristall', sec: '3.2', ap: 's3-2', cal: ['p_fourier_xarxa'],
          desc: 'L\'amplitud que arriba al detector és la transformada de Fourier de la densitat electrònica, avaluada al vector de dispersió Δk.',
          sims: ['02_xarxa_reciproca_difraccio/factors_difraccio.html'] },
        { id: 'p_laue', ex: ['2.10'], nom: 'La condició de Laue: Δk = G', sec: '3.4', ap: 's3-4', cal: ['p_amplitud'],
          desc: 'Només hi ha pics de difracció quan el canvi del vector d\'ona coincideix amb un vector de la xarxa recíproca. La construcció d\'Ewald ho fa visual.',
          sims: ['02_xarxa_reciproca_difraccio/ewald_pols.html', '02_xarxa_reciproca_difraccio/laue.html'] },
        { id: 'p_bragg', ex: ['2.6', '2.9', '2.12'], nom: 'La llei de Bragg', sec: '3.5', ap: 's3-5', cal: ['p_laue', 'p_plans'],
          desc: '2d sin θ = nλ: la mateixa condició de Laue, vista com una reflexió en plans cristal·logràfics separats una distància d.',
          sims: ['02_xarxa_reciproca_difraccio/bragg_interferencia.html', '02_xarxa_reciproca_difraccio/difraccio_pols.html'] },
        { id: 'p_forma', nom: 'Factor de forma atòmic', sec: '4.1', ap: 'sec:forma', cal: ['p_amplitud'],
          desc: 'Com la mida finita del núvol electrònic de cada àtom fa baixar la intensitat dels pics a angles grans.',
          sims: ['02_xarxa_reciproca_difraccio/factors_difraccio.html'] },
        { id: 'p_estructura', ex: ['2.5', '2.6', '2.7'], nom: 'Factor d\'estructura i extincions', sec: '4.2', ap: 'sec:estructura', cal: ['p_laue', 'p_base'],
          desc: 'La suma sobre els àtoms de la base: quan s\'anul·la, el pic desapareix encara que es compleixi Laue. Així es distingeixen la BCC, la FCC i el diamant.',
          sims: ['02_xarxa_reciproca_difraccio/extincions_cubiques.html', '02_xarxa_reciproca_difraccio/difraccio_pols.html'] } ] }
    ] },

  { id: 'C', nom: 'Cohesió i elasticitat', curt: 'Cohesió', color: '#6B46C1', temes: 'Tema 3',
    desc: 'Per què els àtoms s\'uneixen en un sòlid: una sola corba d\'energia, tres mecanismes d\'enllaç i, de la corbatura, la rigidesa del material.',
    estacions: [
      { id: 'C1', nom: 'La corba de cohesió', curt: 'Corba e(r)', tema: '03', conceptes: [
        { id: 'c_corba', nom: 'La corba de cohesió e(r)', sec: '1', ap: 'sec:corba',
          desc: 'L\'energia per àtom en funció de la distància entre veïns. Una atracció de llarg abast i la repulsió de Pauli de curt abast donen sempre un mínim.',
          sims: ['03_cohesio/corba_cohesio.html'] },
        { id: 'c_tres', nom: 'Els tres números de la corba: r₀, E_coh i e″(r₀)', sec: '1', ap: 'sec:corba', cal: ['c_corba'],
          desc: 'La posició del mínim dona el paràmetre de xarxa; la profunditat, l\'energia de cohesió; la corbatura, la rigidesa del cristall.',
          sims: ['03_cohesio/corba_cohesio.html'] } ] },
      { id: 'C2', nom: 'Gasos nobles: van der Waals', curt: 'Van der Waals', tema: '03', conceptes: [
        { id: 'c_polar', nom: 'Polaritzabilitat d\'un àtom', sec: '2.1', ap: 's2-1', cal: ['t_oscil'],
          desc: 'Un camp elèctric desplaça el núvol electrònic respecte del nucli i indueix un dipol μ = αE. Amb el núvol lligat al nucli per una molla, α = e²/C.',
          sims: ['03_cohesio/polaritzabilitat.html'] },
        { id: 'c_london', nom: 'La força de London', sec: '2.2', ap: 'sec:london', cal: ['c_polar', 't_oscil_q'],
          desc: 'Dos àtoms neutres sense dipol permanent s\'atrauen. L\'acoblament separa les freqüències dels dos modes normals i l\'energia de punt zero baixa com −A/R⁶.',
          sims: ['03_cohesio/forces_london.html'] },
        { id: 'c_correlacio', nom: 'Correlació entre dipols', sec: '2.3', ap: 's2-3', cal: ['c_london'],
          desc: 'Cada dipol fluctua a l\'atzar, però tots dos tendeixen a apuntar en el mateix sentit: aquesta correlació és l\'origen de l\'atracció.',
          sims: ['03_cohesio/forces_london.html'] },
        { id: 'c_lj', ex: ['3.3'], nom: 'Potencial de Lennard-Jones', sec: '2.4', ap: 'sec:lj', cal: ['c_london'],
          desc: '4ε[(σ/r)¹² − (σ/r)⁶]: l\'atracció de London més una repulsió fenomenològica, amb dos paràmetres, ε i σ, per a cada gas noble.' },
        { id: 'c_sumes', ex: ['3.2', '3.3'], nom: 'Sumes de xarxa: del parell al cristall', sec: '2.5', ap: 'sec:sumes', cal: ['c_lj', 'p_estructures'],
          desc: 'L\'energia del cristall és la suma del potencial de parell sobre tots els veïns. Les constants A₁₂ i A₆ de cada estructura donen r₀, e₀ i B, que es comparen amb l\'experiment.',
          sims: ['03_cohesio/sumes_xarxa.html'] } ] },
      { id: 'C3', nom: 'Cristalls iònics', curt: 'Iònics', tema: '03', conceptes: [
        { id: 'c_coulomb', nom: 'Energia de Coulomb d\'un cristall iònic', sec: '3.1', ap: 's3-1', cal: ['c_corba'],
          desc: 'Cada ió interacciona amb tots els altres amb ±ke²/r: l\'energia és una suma amb signes alterns.' },
        { id: 'c_madelung', ex: ['3.5', '3.6'], nom: 'La constant de Madelung', sec: '3.2–3.3', ap: 's3-2', cal: ['c_coulomb', 'p_estructures'],
          desc: 'La suma amb signes alterns es resumeix en un número, M = 1.7476 per al NaCl. És una sèrie condicionalment convergent: el resultat depèn de com s\'ordenen els termes.',
          sims: ['03_cohesio/madelung.html'] },
        { id: 'c_ionic', ex: ['3.4', '3.5', '3.6', '3.7'], nom: 'Energia de cohesió iònica', sec: '3.4', ap: 'sec:ionic_total', cal: ['c_madelung'],
          desc: 'L\'atracció de Madelung més una repulsió de curt abast: el mínim dona r₀ i l\'energia per parell d\'ions, que es compara amb la mesura.',
          sims: ['03_cohesio/corba_cohesio.html'] } ] },
      { id: 'C4', nom: 'Enllaç covalent', curt: 'Covalent', tema: '03', conceptes: [
        { id: 'c_h2', nom: 'L\'ió H₂⁺: el covalent més simple', sec: '4.2', ap: 's4-2', cal: ['t_schrodinger'],
          desc: 'Un electró i dos protons: la funció d\'ona es busca com una combinació lineal dels dos orbitals 1s (LCAO).',
          sims: ['03_cohesio/enllac_covalent.html'] },
        { id: 'c_enllacant', nom: 'Estats enllaçant i antienllaçant', sec: '4.3', ap: 's4-3', cal: ['c_h2'],
          desc: 'La combinació simètrica acumula càrrega entre els nuclis i baixa l\'energia; l\'antisimètrica la treu d\'entremig i la puja.',
          sims: ['03_cohesio/enllac_covalent.html'] },
        { id: 'c_direccional', nom: 'Direccionalitat de l\'enllaç', sec: '4.4', ap: 's4-4', cal: ['c_enllacant', 'p_estructures'],
          desc: 'Per què els enllaços covalents tenen direccions preferents, com els tetraedres del diamant, i els iònics o els de van der Waals no.' } ] },
      { id: 'C5', nom: 'Mòdul de compressibilitat', curt: 'Mòdul B', tema: '03', conceptes: [
        { id: 'c_B', ex: ['3.5'], nom: 'El mòdul de compressibilitat B', sec: '5', ap: 'sec:B', cal: ['c_tres'],
          desc: 'B = −V dP/dV surt de la corbatura de la corba al mínim, B = e″(r₀)/(9 g r₀). Explica per què el diamant és cent vegades més rígid que l\'argó.',
          sims: ['03_cohesio/corba_cohesio.html'] } ] },
      { id: 'C6', nom: 'Elasticitat macroscòpica', curt: 'Elasticitat', tema: '03', conceptes: [
        { id: 'c_deformacio', nom: 'Deformacions i tensions', sec: '6.1–6.2', ap: 's6-1',
          desc: 'Com es descriu que un sòlid s\'estira o es torça (el tensor de deformació) i les forces internes que hi apareixen (el tensor de tensions).',
          sims: ['03_cohesio/laboratori_elasticitat.html'] },
        { id: 'c_hooke', ex: ['3.8', '3.11'], nom: 'Llei de Hooke i constants elàstiques', sec: '6.3–6.4', ap: 's6-3', cal: ['c_deformacio', 'p_sistemes'],
          desc: 'La tensió és proporcional a la deformació. En un cristall cúbic la simetria deixa només tres constants, C₁₁, C₁₂ i C₄₄, i d\'aquí surten B, E i ν.',
          sims: ['03_cohesio/ones_elastiques.html'] },
        { id: 'c_ones', ex: ['3.9', '3.10', '3.12'], nom: 'Equació d\'ones elàstiques', sec: '6.5', ap: 'sec:ones', cal: ['c_hooke'],
          desc: 'Les equacions de Newton per al medi continu donen ones longitudinals i transversals, amb velocitats que depenen de les constants elàstiques i de la direcció.',
          sims: ['03_cohesio/ones_elastiques.html', '03_cohesio/laboratori_elasticitat.html'] },
        { id: 'c_fractura', nom: 'Assaig de tracció i fractura', sec: '6.6–6.7', ap: 's6-6', cal: ['c_hooke'],
          desc: 'La corba tensió-deformació real: on deixa de valer la llei de Hooke, i per què un forat o una esquerda concentren la tensió i fan trencar el material abans.',
          sims: ['03_cohesio/laboratori_elasticitat.html'] } ] }
    ] },

  { id: 'V', nom: 'Vibracions i fonons', curt: 'Vibracions', color: '#0E7C86', temes: 'Temes 4–5',
    desc: 'De la corbatura de la corba de cohesió a les ones que travessen el cristall i, quantitzades, als fonons que porten la calor.',
    estacions: [
      { id: 'V1', nom: 'De la corba a la molla', curt: 'Molla', tema: '04', conceptes: [
        { id: 'v_harmonica', ex: ['4.6'], nom: 'Aproximació harmònica: C = e″(r₀)', sec: '1', ap: 'sec:molla', cal: ['c_tres', 't_oscil'],
          desc: 'Prop del mínim, la corba de cohesió és una paràbola: cada parell de veïns es comporta com una molla de constant C = e″(r₀).' } ] },
      { id: 'V2', nom: 'La cadena monoatòmica', curt: 'Cadena 1 àtom', tema: '04', conceptes: [
        { id: 'v_mono', ex: ['4.1', '4.2'], nom: 'Equacions de moviment i ones planes', sec: '2.1–2.2', ap: 's2-1', cal: ['v_harmonica'],
          desc: 'La segona llei de Newton per a cada àtom de la cadena, i la solució en ones planes uₙ = A e^(i(qna − ωt)).',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] },
        { id: 'v_dispersio', ex: ['4.1'], nom: 'Relació de dispersió ω(q)', sec: '2.2', ap: 's2-2', cal: ['v_mono'],
          desc: 'ω = 2√(C/M)|sin(qa/2)|: cada longitud d\'ona té la seva freqüència, i n\'hi ha una de màxima.',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] },
        { id: 'v_brillouin', ex: ['2.11', '7.2'], nom: 'La zona de Brillouin', sec: '2.3', ap: 's2-3', cal: ['v_dispersio', 'p_reciproca', 'p_cella'],
          desc: 'Dos q que difereixen en un vector de la xarxa recíproca mouen els àtoms igual: n\'hi ha prou amb la primera zona de Brillouin, la cel·la de Wigner-Seitz de la xarxa recíproca. Amb condicions de contorn periòdiques hi caben exactament N valors de q.',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] },
        { id: 'v_so', ex: ['4.3', '4.6'], nom: 'Longitud d\'ona llarga: el so', sec: '2.4', ap: 'sec:so', cal: ['v_dispersio', 'c_ones'],
          desc: 'Per a q petit, ω ∝ q: la cadena es comporta com un medi continu i el pendent és la velocitat del so, que lliga les molles amb les constants elàstiques.',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] },
        { id: 'v_grup', nom: 'Velocitat de fase i velocitat de grup', sec: '2.5', ap: 's2-5', cal: ['v_dispersio'], veure: ['p_bragg'],
          desc: 'v_g = dω/dq és la velocitat a què viatja l\'energia. A la vora de la zona s\'anul·la: les ones són estacionàries, com en una reflexió de Bragg.',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] },
        { id: 'v_constants', ex: ['4.5'], nom: 'Constants de força a partir de ω(q)', sec: '2.6', ap: 'sec:constants', cal: ['v_dispersio', 'p_fourier'],
          desc: 'Si es mesura la relació de dispersió (per exemple, amb neutrons), la seva sèrie de Fourier dona les constants de força entre veïns llunyans.',
          sims: ['04_dinamica_xarxa/cadena_monoatomica.html'] } ] },
      { id: 'V3', nom: 'La cadena diatòmica', curt: 'Cadena 2 àtoms', tema: '04', conceptes: [
        { id: 'v_matriu2', ex: ['4.4'], nom: 'Dos àtoms per cel·la: la matriu dinàmica 2×2', sec: '3.1–3.2', ap: 's3-1', cal: ['v_mono'],
          desc: 'Amb dues masses o dues molles per cel·la, les equacions de moviment es tornen un problema de valors propis 2×2 per a cada q.',
          sims: ['04_dinamica_xarxa/cadena_diatomica.html'] },
        { id: 'v_branques', ex: ['4.4'], nom: 'Branques acústica i òptica', sec: '3.3', ap: 's3-3', cal: ['v_matriu2'],
          desc: 'Dues solucions per a cada q: l\'acústica (els àtoms es mouen en fase i ω → 0) i l\'òptica (en oposició, amb el centre de masses quiet).',
          sims: ['04_dinamica_xarxa/cadena_diatomica.html'] },
        { id: 'v_buit', nom: 'El buit de freqüències', sec: '3.4', ap: 's3-4', cal: ['v_branques'],
          desc: 'Entre les dues branques hi ha freqüències que no es poden propagar. El buit creix amb la diferència de masses o de molles.',
          sims: ['04_dinamica_xarxa/cadena_diatomica.html'] } ] },
      { id: 'V4', nom: 'Vibracions en tres dimensions', curt: 'Tres dimensions', tema: '04', conceptes: [
        { id: 'v_matriu3d', nom: 'La matriu dinàmica en 3D', sec: '4.1–4.2', ap: 's4-1', cal: ['v_matriu2', 'p_estructures'],
          desc: 'Cada àtom es mou en tres direccions: la matriu dinàmica és 3r×3r per a r àtoms a la base, i es construeix amb les constants de força entre veïns.',
          sims: ['04_dinamica_xarxa/fonons_3d.html'] },
        { id: 'v_disp3d', nom: 'Relacions de dispersió en 3D', sec: '4.3', ap: 's4-3', cal: ['v_matriu3d', 'v_brillouin'],
          desc: 'Tres branques acústiques (una longitudinal i dues transversals) i 3r − 3 d\'òptiques, representades al llarg de camins dins de la zona de Brillouin.',
          sims: ['04_dinamica_xarxa/fonons_3d.html'] },
        { id: 'v_nmodes', nom: 'Nombre de modes: 3rN', sec: '4.4', ap: 's4-4', cal: ['v_disp3d'],
          desc: 'Un cristall de N cel·les amb r àtoms a la base té exactament 3rN modes normals: tants com graus de llibertat.' } ] },
      { id: 'V5', nom: 'Fonons', curt: 'Fonons', tema: '05', conceptes: [
        { id: 'v_dulong', nom: 'Dulong-Petit i el que no quadra', sec: '1', ap: 'sec:intro', cal: ['t_stat'],
          desc: 'L\'equipartició prediu 3R per mol a qualsevol temperatura, però a baixa temperatura la calor específica cau a zero. La física clàssica no ho explica.',
          sims: ['05_fonons/calor_especifica.html'] },
        { id: 'v_fono', ex: ['5.6'], nom: 'El fonó', sec: '2.1', ap: 's2-1', cal: ['t_oscil_q', 'v_nmodes'],
          desc: 'Cada mode normal és un oscil·lador quàntic: la seva energia puja en quants ħω, els fonons, que es comporten com partícules amb moment cristal·lí ħq.' },
        { id: 'v_planck', nom: 'La distribució de Planck', sec: '2.2', ap: 's2-2', cal: ['v_fono', 't_stat'], veure: ['e_fd'],
          desc: 'El nombre mitjà de fonons d\'un mode a temperatura T és 1/(e^(ħω/kT) − 1). Els modes amb ħω ≫ kT queden congelats.',
          sims: ['05_fonons/calor_especifica.html'] },
        { id: 'v_cmode', nom: 'Energia i calor específica d\'un mode', sec: '2.3', ap: 's2-3', cal: ['v_planck'],
          desc: 'Cada mode aporta k a alta temperatura i gairebé res quan ħω ≫ kT: aquesta és la clau de la caiguda de la calor específica.' } ] },
      { id: 'V6', nom: 'Densitat d\'estats dels fonons', curt: 'Densitat g(ω)', tema: '05', conceptes: [
        { id: 'v_dos', ex: ['5.4'], nom: 'Densitat d\'estats g(ω)', sec: '3', ap: 'sec:dos', cal: ['v_dispersio', 'v_nmodes'], veure: ['e_dos'],
          desc: 'Quants modes hi ha entre ω i ω + dω. En 3D i a baixa freqüència, g(ω) ∝ ω². Converteix les sumes sobre modes en integrals.',
          sims: ['05_fonons/calor_especifica.html'] } ] },
      { id: 'V7', nom: 'Einstein i Debye', curt: 'Einstein i Debye', tema: '05', conceptes: [
        { id: 'v_einstein', ex: ['5.1'], nom: 'El model d\'Einstein', sec: '4', ap: 'sec:einstein', cal: ['v_cmode'],
          desc: 'Tots els modes amb la mateixa freqüència: explica la caiguda a baixa temperatura, però massa ràpida (exponencial).',
          sims: ['05_fonons/calor_especifica.html'] },
        { id: 'v_debye', ex: ['5.1', '5.2', '5.3', '5.7'], nom: 'El model de Debye i la llei T³', sec: '5', ap: 'sec:debye', cal: ['v_cmode', 'v_dos', 'v_so'],
          desc: 'Modes acústics amb ω = vq fins a una freqüència de tall. A baixa temperatura C ∝ T³, com a l\'experiment.',
          sims: ['05_fonons/calor_especifica.html'] },
        { id: 'v_thetaD', ex: ['5.2', '5.3'], nom: 'Temperatura de Debye i calor específica real', sec: '5.4, 6', ap: 's5-4', cal: ['v_debye'],
          desc: 'Θ_D separa el règim quàntic del clàssic. Mesurant T en unitats de Θ_D, la calor específica de tots els sòlids cau sobre una corba universal.',
          sims: ['05_fonons/calor_especifica.html'] } ] },
      { id: 'V8', nom: 'Conductivitat tèrmica', curt: 'Conductivitat', tema: '05', conceptes: [
        { id: 'v_fourierllei', nom: 'Llei de Fourier i recorregut lliure mitjà', sec: '7.1–7.2', ap: 's7-1',
          desc: 'El flux de calor és proporcional al gradient de temperatura, J = −K∇T. El recorregut lliure mitjà ℓ és la distància que fa un portador entre dos xocs.' },
        { id: 'v_cinetica', nom: 'Teoria cinètica: K = ⅓Cvℓ', sec: '7.3', ap: 's7-3', cal: ['v_fourierllei', 'v_debye', 'v_grup'], veure: ['e_drude'],
          desc: 'En un aïllant la calor la porten els fonons: la conductivitat és el producte de la calor específica, la velocitat i el recorregut lliure mitjà.',
          sims: ['05_fonons/conductivitat_termica.html'] },
        { id: 'v_mecanismes', nom: 'Què limita el recorregut lliure mitjà', sec: '7.5–7.6', ap: 'sec:mecanismes', cal: ['v_cinetica', 'v_brillouin'],
          desc: 'Les vores de la mostra, els isòtops i els xocs entre fonons (umklapp). La regla de Matthiessen els combina i explica el màxim de K(T).',
          sims: ['05_fonons/conductivitat_termica.html'] },
        { id: 'v_mida', nom: 'La mida importa', sec: '7.7', ap: 's7-7', cal: ['v_mecanismes'],
          desc: 'En un nanofil les vores limiten ℓ, i la conductivitat cau molt per sota de la del material massís.',
          sims: ['05_fonons/conductivitat_termica.html'] } ] }
    ] },

  { id: 'F', nom: 'Electrons lliures', curt: 'Electrons lliures', color: '#9C4221', temes: 'Tema 6',
    desc: 'Els electrons de conducció d\'un metall com un gas de fermions dins d\'una caixa: el principi d\'exclusió fixa l\'energia de Fermi, i d\'aquí surten la calor específica electrònica i el transport.',
    estacions: [
      { id: 'F1', nom: 'Electrons en una caixa', curt: 'Electrons en una caixa', tema: '06', conceptes: [
        { id: 'e_lliure', nom: 'El model d\'electrons lliures', sec: '2.1', ap: 's2-1', ref: 'Kittel, cap. 6', cal: ['t_schrodinger'],
          desc: 'Els electrons de valència d\'un metall es mouen en un potencial constant: ones planes amb energia ħ²k²/2m.' },
        { id: 'e_contorn', nom: 'Condicions de contorn periòdiques i quantització de k', sec: '2.2–2.3', ap: 's2-2', ref: 'Kittel, cap. 6', cal: ['e_lliure'], veure: ['v_brillouin'],
          desc: 'Imposar que la funció d\'ona es repeteixi a les cares del cristall fa que k prengui valors discrets: un per cada volum (2π)³/V de l\'espai k. Les condicions dures donen el mateix nombre d\'estats.' } ] },
      { id: 'F2', nom: 'El gas de Fermi a T = 0', curt: 'Gas de Fermi', tema: '06', conceptes: [
        { id: 'e_esfera', ex: ['6.4'], nom: 'Espai k i esfera de Fermi', sec: '3.1', ap: 's3-1', ref: 'Kittel, cap. 6', cal: ['e_contorn'],
          desc: 'A T = 0 els electrons omplen els estats de menor energia, dos per cada k (espín): una esfera de radi k_F = (3π²n)^(1/3).' },
        { id: 'e_dos', ex: ['6.3'], nom: 'Densitat d\'estats g(ε)', sec: '4.1–4.2', ap: 'sec:dos', ref: 'Kittel, cap. 6', cal: ['e_esfera'], veure: ['v_dos'],
          desc: 'Quants estats electrònics hi ha per interval d\'energia. En 3D, g(ε) ∝ √ε; en 2D és constant i en 1D divergeix a baixa energia.',
          sims: ['06_fermi_electrons/densitat_estats_dimensions.html'] },
        { id: 'e_T0', ex: ['6.1', '6.2', '6.8'], nom: 'Energia de Fermi i energia a T = 0', sec: '4.3', ap: 's4-3', ref: 'Kittel, cap. 6', cal: ['e_dos'],
          desc: 'Integrant g(ε) fins a ε_F s\'obté ε_F = (ħ²/2m)(3π²n)^(2/3), i l\'energia mitjana per electró, ³⁄₅ ε_F.' },
        { id: 'e_escales', ex: ['6.4', '6.5'], nom: 'Escales del gas de Fermi: ε_F, T_F i v_F', sec: '3.2', ap: 's3-2', ref: 'Kittel, cap. 6', cal: ['e_T0'],
          desc: 'En un metall ε_F val uns quants eV, T_F = ε_F/k unes desenes de milers de kelvin i v_F ~ 10⁶ m/s: a temperatura ambient el gas d\'electrons és completament degenerat.' } ] },
      { id: 'F3', nom: 'Temperatura finita', curt: 'Fermi-Dirac', tema: '06', conceptes: [
        { id: 'e_fd', ex: ['6.3'], nom: 'La distribució de Fermi-Dirac', sec: '5.1–5.2', ap: 'sec:fd', ref: 'Kittel, cap. 6', cal: ['t_stat'], veure: ['v_planck'],
          desc: 'La probabilitat que un estat d\'energia ε estigui ocupat, 1/(e^((ε−μ)/kT) + 1). Només els estats a pocs kT de μ noten la temperatura.',
          sims: ['06_fermi_electrons/simulador_sommerfeld.html'] },
        { id: 'e_degenerat', nom: 'Gas degenerat i gas no degenerat', sec: '5.3', ap: 'sec:degenerat', ref: 'Kittel, cap. 6', cal: ['e_fd', 'e_escales'], veure: ['e_portadors'],
          desc: 'Si T ≪ T_F, el gas és degenerat: els estats per sota de μ són plens i mana el principi d\'exclusió (els electrons d\'un metall). Si T ≫ T_F, μ cau per sota del fons de la banda i Fermi-Dirac es redueix a la distribució de Boltzmann: el gas es comporta com un de clàssic (els electrons d\'un semiconductor).' },
        { id: 'e_sommerfeld', nom: 'L\'expansió de Sommerfeld', sec: '6', ap: 'sec:sommerfeld', ref: 'Kittel, cap. 6', cal: ['e_T0', 'e_fd'],
          desc: 'Com es calculen integrals amb la distribució de Fermi-Dirac quan kT ≪ ε_F. El potencial químic baixa una mica, μ ≈ ε_F[1 − (π²/12)(kT/ε_F)²].',
          sims: ['06_fermi_electrons/simulador_sommerfeld.html'] },
        { id: 'e_cv', nom: 'Calor específica electrònica: C = γT', sec: '7', ap: 'sec:cv', ref: 'Kittel, cap. 6', cal: ['e_sommerfeld', 'v_debye'],
          desc: 'Només s\'exciten els electrons a ~kT de ε_F: C_el = (π²/2)Nk(T/T_F), cent vegades menys que la clàssica. A baixa temperatura un metall té C = γT + AT³: electrons més fonons.',
          sims: ['06_fermi_electrons/simulador_sommerfeld.html'] } ] },
      { id: 'F4', nom: 'Transport en els metalls', curt: 'Transport', tema: '06', conceptes: [
        { id: 'e_drude', ex: ['6.6'], nom: 'Conductivitat elèctrica i llei d\'Ohm', sec: '8.1–8.3', ap: 'sec:sigma', ref: 'Kittel, cap. 6', cal: ['e_esfera'], veure: ['v_cinetica'],
          desc: 'Un camp elèctric desplaça tota l\'esfera de Fermi i les col·lisions la frenen cada temps τ: σ = ne²τ/m. Només els electrons de la superfície de Fermi poden canviar d\'estat.',
          sims: ['06_fermi_electrons/drude_classic.html', '06_fermi_electrons/drude_fermi.html'] },
        { id: 'e_resistivitat', ex: ['6.10'], nom: 'Resistivitat dels metalls: fonons i impureses', sec: '8.4', ap: 's8-4', ref: 'Kittel, cap. 6', cal: ['e_drude'], veure: ['v_mecanismes'],
          desc: 'La resistivitat és la suma d\'una part dels fonons, que creix amb T, i d\'una part residual de les impureses (regla de Matthiessen).' },
        { id: 'e_hall', ex: ['6.7', '6.9', '8.3'], nom: 'Moviment en un camp magnètic: efecte Hall', sec: '9', ap: 'sec:hall', ref: 'Kittel, cap. 6', cal: ['e_drude'],
          desc: 'Un camp magnètic corba les trajectòries: freqüència de ciclotró ω_c = eB/m, i un camp transversal de Hall amb R_H = −1/ne, que dona la densitat i el signe dels portadors.',
          sims: ['06_fermi_electrons/drude_classic.html', '06_fermi_electrons/drude_fermi.html'] },
        { id: 'e_wf', nom: 'Conductivitat tèrmica dels metalls: Wiedemann-Franz', sec: '10', ap: 'sec:termica', ref: 'Kittel, cap. 6', cal: ['e_drude', 'e_cv'], veure: ['v_cinetica'],
          desc: 'Els mateixos electrons porten la calor i el corrent: K = ⅓C_el v_F ℓ, i K/σT = (π²/3)(k/e)², el mateix per a tots els metalls.' } ] }
    ] },

  { id: 'B', nom: 'Bandes d\'energia', curt: 'Bandes', color: '#3C366B', temes: 'Tema 7',
    desc: 'Què passa quan l\'electró lliure nota el potencial periòdic dels ions: el teorema de Bloch, l\'obertura de gaps a la vora de la zona de Brillouin i la diferència entre metalls i aïllants.',
    estacions: [
      { id: 'B1', nom: 'El teorema de Bloch', curt: 'Bloch', tema: '07', conceptes: [
        { id: 'e_bloch', nom: 'El teorema de Bloch', sec: '1.1', ref: 'Kittel, cap. 7', cal: ['e_contorn', 'p_fourier_xarxa'],
          desc: 'En un potencial periòdic, les funcions d\'ona són ones planes modulades amb la periodicitat de la xarxa: ψ = e^(ik·r) u(r).',
          sims: ['07_bloch_bandes/bloch_ones_planes.html'] },
        { id: 'e_moment', nom: 'El moment cristal·lí ħk', sec: '1.1', ref: 'Kittel, cap. 7', cal: ['e_bloch', 'v_brillouin'], veure: ['v_fono'],
          desc: 'k està definit llevat d\'un vector G de la xarxa recíproca, i n\'hi ha prou amb la primera zona de Brillouin. ħk no és el moment de l\'electró, però es conserva en els xocs llevat d\'un ħG.' } ] },
      { id: 'B2', nom: 'L\'equació central', curt: 'Equació central', tema: '07', conceptes: [
        { id: 'e_recip_eq', nom: 'L\'equació de Schrödinger a l\'espai recíproc', sec: '1.2', ref: 'Kittel, cap. 7', cal: ['e_bloch', 'p_reciproca'],
          desc: 'Escrivint ψ i el potencial com a sèries de Fourier, l\'equació es converteix en un sistema que acobla els coeficients de k i de k − G: l\'equació central.' },
        { id: 'e_buida', ex: ['7.1', '7.2'], nom: 'La xarxa buida: bandes plegades a la zona reduïda', sec: '2.1', ref: 'Kittel, cap. 7', cal: ['e_recip_eq', 'v_brillouin'],
          desc: 'Amb potencial nul, les paràboles ħ²(k − G)²/2m dibuixades dins de la primera zona ja formen bandes. On dues es creuen, el potencial obrirà un gap.',
          sims: ['07_bloch_bandes/bloch_ones_planes.html'] } ] },
      { id: 'B3', nom: 'El gap a la vora de la zona', curt: 'Gap', tema: '07', conceptes: [
        { id: 'e_origen_gap', nom: 'Origen del gap: ones estacionàries', sec: '2.2', ref: 'Kittel, cap. 7', cal: ['e_buida', 'p_bragg'],
          desc: 'A la vora de la zona, les ones e^(±iπx/a) es reflecteixen per Bragg i formen dues ones estacionàries: una acumula la càrrega sobre els ions (energia més baixa) i l\'altra entre ells.' },
        { id: 'e_nfe', ex: ['7.4'], nom: 'Magnitud del gap: E_g = 2|U_G|', sec: '2.2', ref: 'Kittel, cap. 7', cal: ['e_origen_gap'],
          desc: 'Resolent l\'equació central amb només dues ones, k i k − G, s\'obté el gap 2|U_G|, on U_G és el component de Fourier del potencial; prop de la vora les bandes es corben.',
          sims: ['07_bloch_bandes/bloch_ones_planes.html'] } ] },
      { id: 'B4', nom: 'El model de Kronig-Penney', curt: 'Kronig-Penney', tema: '07', conceptes: [
        { id: 'e_kp', ex: ['7.3'], nom: 'Bandes i gaps exactes en una dimensió', ref: 'Kittel, cap. 7', cal: ['e_bloch'],
          desc: 'Un potencial periòdic de pous quadrats (o de deltes) es resol exactament amb el teorema de Bloch: l\'equació té la forma cos ka = f(ε), i hi ha bandes permeses on |f(ε)| ≤ 1 i gaps on |f(ε)| > 1.' } ] },
      { id: 'B5', nom: 'Enllaç fort', curt: 'Enllaç fort', tema: '07', conceptes: [
        { id: 'e_tb', nom: 'Tight-binding: de nivells atòmics a bandes', sec: '3', ref: 'Kittel, cap. 9', cal: ['c_enllacant', 'e_bloch'],
          desc: 'Partint dels orbitals atòmics, com a l\'H₂⁺, N àtoms en cadena converteixen cada nivell en una banda de N estats, ε(k) = ε₀ − 2t cos ka, d\'amplada proporcional al solapament.' } ] },
      { id: 'B6', nom: 'Metalls, aïllants i semimetalls', curt: 'Metalls i aïllants', tema: '07', conceptes: [
        { id: 'e_norbitals', nom: 'Nombre d\'estats d\'una banda: 2N', ref: 'Kittel, cap. 7', cal: ['e_moment'],
          desc: 'Cada banda té N valors de k dins de la zona de Brillouin, un per cel·la primitiva, i dos estats d\'espín per a cada k: 2N electrons l\'omplen.' },
        { id: 'e_bandes', ex: ['7.1'], nom: 'Bandes plenes i buides', ref: 'Kittel, cap. 7', cal: ['e_norbitals', 'e_nfe', 'e_T0'],
          desc: 'Un material és metall si l\'última banda ocupada està a mitges, aïllant si està plena i el gap és gran, i semimetall si dues bandes se solapen una mica. En aquest model, amb un nombre senar d\'electrons de valència per cel·la és sempre metall.' } ] }
    ] },

  { id: 'S', nom: 'Semiconductors', curt: 'Semiconductors', color: '#B83280', temes: 'Tema 8',
    desc: 'Aïllants amb un gap prou petit perquè la temperatura i les impureses hi posin portadors: electrons, forats, dopatge i, al final, la unió pn.',
    estacions: [
      { id: 'S1', nom: 'El gap dels semiconductors', curt: 'Gap', tema: '08', conceptes: [
        { id: 'e_gap', nom: 'Gap directe i indirecte', ref: 'Kittel, cap. 8', cal: ['e_bandes'], veure: ['v_fono'],
          desc: 'El gap es mesura per l\'absorció de llum. Si el mínim de la banda de conducció i el màxim de la de valència no són al mateix k, cal un fonó per absorbir: és un gap indirecte, com al Si i al Ge.' } ] },
      { id: 'S2', nom: 'Dinàmica a la banda', curt: 'Massa efectiva', tema: '08', conceptes: [
        { id: 'e_semiclassic', ex: ['8.4'], nom: 'Equació de moviment: ħ dk/dt = F', ref: 'Kittel, cap. 8', cal: ['e_moment'],
          desc: 'Un paquet d\'ones de Bloch es mou amb la velocitat de grup v = (1/ħ) dε/dk, i una força externa li canvia el moment cristal·lí com ħ dk/dt = F.' },
        { id: 'e_massa', ex: ['8.4'], nom: 'Massa efectiva', ref: 'Kittel, cap. 8', cal: ['e_semiclassic'],
          desc: 'Prop d\'un mínim de banda l\'electró respon com una partícula lliure de massa m* = ħ²/(d²ε/dk²). La corbatura de la banda fa el paper de la massa; es mesura per ressonància de ciclotró.' },
        { id: 'e_forats', nom: 'Forats', ref: 'Kittel, cap. 8', cal: ['e_massa'],
          desc: 'Un estat buit al capdamunt d\'una banda plena es comporta com una partícula de càrrega +e i massa efectiva positiva: el forat.' } ] },
      { id: 'S3', nom: 'Portadors intrínsecs', curt: 'Intrínsecs', tema: '08', conceptes: [
        { id: 'e_portadors', nom: 'Concentració intrínseca: n·p = n_i²', ref: 'Kittel, cap. 8', cal: ['e_forats', 'e_dos', 'e_degenerat'],
          desc: 'Amb la densitat d\'estats de cada banda i la cua de Boltzmann de la distribució de Fermi-Dirac, n·p = n_i² només depèn del gap i de T (llei d\'acció de masses), i n_i ∝ e^(−E_g/2kT).' },
        { id: 'e_mobilitat', ex: ['8.6'], nom: 'Mobilitat', ref: 'Kittel, cap. 8', cal: ['e_drude', 'e_massa'],
          desc: 'La velocitat de deriva és proporcional al camp, v = μE, amb μ = eτ/m*; electrons i forats tenen mobilitats diferents.' } ] },
      { id: 'S4', nom: 'Impureses i dopatge', curt: 'Dopatge', tema: '08', conceptes: [
        { id: 'e_dopatge', ex: ['8.1', '8.2'], nom: 'Donadors i acceptors: el model hidrogenoide', ref: 'Kittel, cap. 8', cal: ['e_portadors'],
          desc: 'Una impuresa amb un electró de més (o de menys) crea un nivell prop d\'una banda. L\'àtom d\'hidrogen amb massa m* i constant dielèctrica ε en dona l\'energia d\'ionització, d\'uns pocs a unes desenes de meV.' },
        { id: 'e_ionitzacio', ex: ['8.2'], nom: 'Ionització tèrmica dels donadors', ref: 'Kittel, cap. 8', cal: ['e_dopatge', 'e_fd'],
          desc: 'Quants donadors estan ionitzats a cada temperatura: a baixa T la concentració d\'electrons creix com e^(−E_d/2kT), i a temperatura ambient gairebé tots ho estan.' } ] },
      { id: 'S5', nom: 'Transport: deriva i difusió', curt: 'Deriva i difusió', tema: '08', conceptes: [
        { id: 'e_deriva', ex: ['8.3', '8.6', '8.7'], nom: 'Corrents de deriva i de difusió', sec: '1.1', cal: ['e_mobilitat', 'e_ionitzacio'],
          desc: 'Els portadors es mouen arrossegats pel camp elèctric (deriva, amb la mobilitat) i des d\'on n\'hi ha més cap on n\'hi ha menys (difusió).' },
        { id: 'e_bandes_pot', nom: 'Potencial electrostàtic i bandes', sec: '1.2', cal: ['e_deriva'],
          desc: 'Un potencial que varia en l\'espai desplaça les energies de les bandes: on hi ha camp elèctric, les bandes es corben.' },
        { id: 'e_einstein', ex: ['8.8'], nom: 'La relació d\'Einstein', sec: '1.3', cal: ['e_deriva', 'e_fd'],
          desc: 'En equilibri, els corrents de deriva i de difusió es compensen. D\'aquí surt D = μkT/e, que lliga la difusió amb la mobilitat.' } ] },
      { id: 'S6', nom: 'La unió pn', curt: 'Unió pn', tema: '08', conceptes: [
        { id: 'e_inhomogeni', ex: ['8.9'], nom: 'Semiconductor amb dopatge no uniforme', sec: '1.4', cal: ['e_einstein', 'e_bandes_pot'],
          desc: 'Si el dopatge canvia d\'un punt a un altre, apareix un camp elèctric intern que equilibra la difusió, i el nivell de Fermi és el mateix a tot arreu.',
          sims: ['08_semiconductors/unio_pn.html'] },
        { id: 'e_pn', ex: ['8.5'], nom: 'La unió pn: aproximació de buidatge', sec: '1.5', cal: ['e_inhomogeni'],
          desc: 'Una zona p al costat d\'una n: la difusió buida de portadors la regió central i hi apareix un potencial de contacte. Amb l\'aproximació de buidatge se\'n calculen el camp, el potencial i l\'amplada.',
          sims: ['08_semiconductors/unio_pn.html'] } ] }
    ] }

] };
