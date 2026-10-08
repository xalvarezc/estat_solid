var reciprocalV1;
var reciprocalV2;

var canvas = document.getElementById("canvas");;
var canvas2 = document.getElementById("canvas2");

var ctx = canvas.getContext("2d");
var ctx2 = canvas2.getContext("2d");


// Get the lattice parameters from user input
var distanceA;
var distanceB;
var angle;
var millerIndex1;
var millerIndex2;
var showPlanes;
var showstandardcell;
var showBasisVectors;
var showBasisVectorsCell;
var sc1v1;
var sc1v2;
var sc2v1;
var sc2v2;

var showwignerseitzcell;
// var scale_r;
// var scale=1;

var RA;
var ZA;
var RB;
var ZB;  
    
var b1;
var b2; 

var CA_SX;
var CA_SY;
var CA_CX;
var CA_CY;

var CB_SX;
var CB_SY;
var CB_CX;
var CB_CY;

var showSymmetry;
var cx;
var cy;
var Tx;
var Ty;
var fRx;
var fRy;
var slider;
var Roperation;

// Define initial scale values
var canvasAScaleX = 15;
var canvasAScaleY = 15;
var canvasBScaleX = 15;
var canvasBScaleY = 15;

// Function to handle the wheel event
function handleWheelEvent(event) {
  event.preventDefault();

  // Get the scale change amount based on the wheel delta
  const scaleChange = event.deltaY > 0 ? -1 : 1;

  // Determine which canvas triggered the event
  const canvasId = event.currentTarget.id;

  // Update the scale based on the canvas ID
  if (canvasId === "canvas") {
    canvasAScaleX += scaleChange;
    canvasAScaleY += scaleChange;
    document.getElementById("canvas_a_scale_x").value = canvasAScaleX;
    document.getElementById("canvas_a_scale_y").value = canvasAScaleY;    
  } else if (canvasId === "canvas2") {
    canvasBScaleX += scaleChange;
    canvasBScaleY += scaleChange;
    document.getElementById("canvas_b_scale_x").value = canvasBScaleX;
    document.getElementById("canvas_b_scale_y").value = canvasBScaleY;    
  }

  // Redraw the lattice with the updated scale
  drawLattice();
}

// Variables to track the dragging state
var isDragging = false;
var dragStartX = 0;
var dragStartY = 0;

// Function to handle the mousedown event
function handleMouseDown(event) {
  event.preventDefault();

  // Get the starting position of the drag
  dragStartX = event.clientX;
  dragStartY = event.clientY;

  // Set the dragging state to true
  isDragging = true;
}

// Function to handle the mousemove event
function handleMouseMove(event) {
  event.preventDefault();

  // Check if dragging is in progress
  if (isDragging) {
    // Calculate the distance moved
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    // Determine which canvas triggered the event
    const canvasId = event.target.id;

    // Update the center based on the canvas ID
    if (canvasId === "canvas") {
      CA_CX += deltaX;
      CA_CY += deltaY;
      document.getElementById("canvas_a_center_x").value = CA_CX/canvas.width;
      document.getElementById("canvas_a_center_y").value = CA_CY/canvas.height;      
    } else if (canvasId === "canvas2") {
      CB_CX += deltaX;
      CB_CY += deltaY;
      document.getElementById("canvas_b_center_x").value = CB_CX/canvas2.width;
      document.getElementById("canvas_b_center_y").value = CB_CY/canvas2.height;      
    }

    // Update the drag starting position for the next movement
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    // Redraw the lattice with the updated center
    drawLattice();
  }
}

// Function to handle the mouseup event
function handleMouseUp(event) {
  event.preventDefault();

  // Set the dragging state to false
  isDragging = false;
}

// Add event listeners to handle the drag events
canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas2.addEventListener("mousedown", handleMouseDown);
canvas2.addEventListener("mousemove", handleMouseMove);
canvas2.addEventListener("mouseup", handleMouseUp);

// Add wheel event listeners to the canvas elements
canvas.addEventListener("wheel", handleWheelEvent);
canvas2.addEventListener("wheel", handleWheelEvent);

function actualitza_valors(){
  // Get the lattice parameters from user input
  distanceA = parseFloat(document.getElementById("distanceA").value);
  distanceB= parseFloat(document.getElementById("distanceB").value);
  angle = parseFloat(document.getElementById("angle").value);
  millerIndex1 = parseInt(document.getElementById("millerIndex1").value);
  millerIndex2 = parseInt(document.getElementById("millerIndex2").value);
  showPlanes = document.getElementById("showPlanes").checked;
  showstandardcell = document.getElementById("showstandardcell").checked;
  showwignerseitzcell = document.getElementById("showwignerseitzcell").checked;    
  showBasisVectors = document.getElementById("showbasisvectors").checked;
  showBasisVectorsCell = document.getElementById("showbasiscellvec").checked;  
//  scale_r = parseInt(document.getElementById("scale_r").value);

  RA = parseFloat(document.getElementById("RA").value);
  ZA= parseFloat(document.getElementById("ZA").value);
  RB = parseFloat(document.getElementById("RB").value);
  ZB= parseFloat(document.getElementById("ZB").value);  
  
  b1 = parseFloat(document.getElementById("b1").value);
  b2 = parseFloat(document.getElementById("b2").value); 

  CA_SX = canvas.width / parseFloat(document.getElementById("canvas_a_scale_x").value);
  CA_SY = canvas.height / parseFloat(document.getElementById("canvas_a_scale_y").value);
  CA_CX = canvas.width * parseFloat(document.getElementById("canvas_a_center_x").value);
  CA_CY = canvas.height * parseFloat(document.getElementById("canvas_a_center_y").value);

  CB_SX = canvas2.width / parseFloat(document.getElementById("canvas_b_scale_x").value);
  CB_SY = canvas2.height / parseFloat(document.getElementById("canvas_b_scale_y").value);
  CB_CX = canvas2.width * parseFloat(document.getElementById("canvas_b_center_x").value);
  CB_CY = canvas2.height * parseFloat(document.getElementById("canvas_b_center_y").value);

  sc1v1 = parseFloat(document.getElementById("sc1v1").value);
  sc1v2 = parseFloat(document.getElementById("sc1v2").value);
  sc2v1 = parseFloat(document.getElementById("sc2v1").value);
  sc2v2 = parseFloat(document.getElementById("sc2v2").value);

  showSymmetry = document.getElementById("showSymmetry").checked; 
  
  cx = parseFloat(document.getElementById("cx").value);
  cy = parseFloat(document.getElementById("cy").value);
  Tx = parseFloat(document.getElementById("Tx").value);
  Ty = parseFloat(document.getElementById("Ty").value);
  fRx = parseFloat(document.getElementById("fRx").value);
  fRy = parseFloat(document.getElementById("fRy").value);
  
  slider = parseFloat(document.getElementById("slider").value)/100;

  Roperation = document.getElementById("Roperation").value;

}

function drawLattice() {
  actualitza_valors();
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

  // Calculate lattice vectors
  const v1 = [distanceA, 0];
  const v2 = [
    distanceB * Math.cos((angle * Math.PI) / 180),
    -distanceB * Math.sin((angle * Math.PI) / 180)
  ];
  const b_v = [
    b1,
    b2
  ];

  // Calculate reciprocal lattice vectors
  determinant = v1[0] * v2[1] - v1[1] * v2[0];
  reciprocalV1 = [2 * Math.PI * v2[1] / determinant, -2 * Math.PI * v2[0] / determinant];
  reciprocalV2 = [-2 * Math.PI * v1[1] / determinant, 2 * Math.PI * v1[0] / determinant];

  // Calculate the Miller planes parameters
  const planeVector1 = [
      reciprocalV1[0] * millerIndex1,
      reciprocalV1[1] * millerIndex1
    ];
  const planeVector2 = [
        reciprocalV2[0] * millerIndex2,
        reciprocalV2[1] * millerIndex2
    ];
  const plane_vector = [
      planeVector1[0] + planeVector2[0], 
      planeVector1[1] + planeVector2[1]
    ]; 

    const interplanarSpacing = 1.0 / Math.sqrt((plane_vector[0] / (2 * Math.PI)) ** 2 + (plane_vector[1] / (2 * Math.PI)) ** 2);
    
  // Draw the direct lattice
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  drawLatticeVectors(ctx, v1, v2, b_v);

  // Draw the reciprocal lattice
  ctx2.strokeStyle = "red";
  ctx2.lineWidth = 3;  
  drawReciprocalLatticeVectors(ctx2, reciprocalV1, reciprocalV2, b_v, RA, RB, ZA, ZB);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 3;  
  if (showPlanes) {
    drawMillerPlanes(ctx, plane_vector, interplanarSpacing);
    }

}

// Function to handle the debounced event
function handleDebouncedEvent(event) {
  const rect = canvas2.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Calculate the reciprocal lattice point closest to the clicked position
  const reciprocalPoint = getClosestReciprocalPoint(mouseX, mouseY);

  // Update the Miller indices input fields
  document.getElementById("millerIndex1").value = reciprocalPoint[0];
  document.getElementById("millerIndex2").value = reciprocalPoint[1];

  // Redraw the lattice to update the displayed Miller planes
  drawLattice();
}
  
function drawLatticeVectors(ctx, v1, v2, b_v) {
//    const canvas = ctx.canvas;

  const center = [canvas.width / 2, canvas.height / 2];

  // Nomes calculem els vertexs de Wigner-Seitz (depen de D3, carregat via CDN)
  // quan realment cal dibuixar-los -- si D3 no s'ha pogut carregar (xarxa
  // bloquejada, sense connexio...), aixo evita que tot el dibuix es quedi en blanc.
  let wignerSeitzVertices = [];
  if (showwignerseitzcell) {
    try {
      wignerSeitzVertices = calculateWignerSeitzVertices(v1, v2);
    } catch (e) {
      console.warn("No s'ha pogut calcular la cel·la de Wigner-Seitz (D3 no disponible?):", e);
    }
  }
  cv1=[sc1v1*v1[0]+sc1v2*v2[0],sc1v1*v1[1]+sc1v2*v2[1]]
  cv2=[sc2v1*v1[0]+sc2v2*v2[0],sc2v1*v1[1]+sc2v2*v2[1]]
  const standard_cell=calculatestandardcell(cv1,cv2);

  // Draw lattice points
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const x = i * v1[0] + j * v2[0];
      const y = i * v1[1] + j * v2[1];
      ctx.beginPath();
      ctx.arc(CA_CX + x * CA_SX, CA_CY + y * CA_SY, RA * CA_SX, 0, 2 * Math.PI);
      ctx.fillStyle = "black";
      ctx.fill();
        if(!(b_v[0]==0 && b_v[1]==0)){
      const x2 = (i + b_v[0]) * v1[0] + (j+b_v[1]) * v2[0];
      const y2 = (i + b_v[0]) * v1[1] + (j+b_v[1]) * v2[1];
      ctx.beginPath();
      ctx.arc(CA_CX + x2 * CA_SX, CA_CY + y2 * CA_SY, RB * CA_SX, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";      
      ctx.fill();}

      if (showwignerseitzcell && wignerSeitzVertices.length > 0) {
      // Draw the polygon using the Wigner-Seitz vertices
      ctx.beginPath();
      ctx.moveTo(CA_CX + x * CA_SX + wignerSeitzVertices[0][0] * CA_SX, CA_CY + y * CA_SY + wignerSeitzVertices[0][1] * CA_SY);
      for (let i = 1; i < wignerSeitzVertices.length; i++) {
        const vertex = wignerSeitzVertices[i];
        ctx.lineTo(CA_CX + x * CA_SX  + vertex[0] * CA_SX, CA_CY + y * CA_SY + vertex[1] * CA_SY);
      }
      ctx.closePath();
      ctx.strokeStyle = "#FFCCCC";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (showstandardcell) {
      // Draw the polygon using the Wigner-Seitz vertices
      ctx.beginPath();
      ctx.moveTo(CA_CX + x * CA_SX + standard_cell[0][0] * CA_SX, CA_CY + y * CA_SY + standard_cell[0][1] * CA_SY);
      for (let i = 1; i < standard_cell.length; i++) {
        const vertex = standard_cell[i];
        ctx.lineTo(CA_CX + x * CA_SX  + vertex[0] * CA_SX, CA_CY + y * CA_SY + vertex[1] * CA_SY);
      }
      ctx.closePath();
      ctx.strokeStyle = "#FFCCFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
      
      }
  }

  if (showSymmetry) {
    M=matriu_operacio_puntual(Roperation,slider);

    ctx.beginPath();
    cx1=cx + (Tx + fRx)*slider;
    cy1=cy + (Ty + fRy)*slider;    
    ctx.arc(CA_CX + cx1 * CA_SX, CA_CY + cy1 * CA_SY, 0.1 * CA_SX, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();    
    ctx.globalAlpha = 0.5    
    for (let i = -10; i <= 10; i++) {
      for (let j = -10; j <= 10; j++) {
        const xp = i * v1[0] + j * v2[0];
        const yp = i * v1[1] + j * v2[1];
        const x = cx + M[0]*(xp-cx) + M[2]*(yp-cy) + (Tx + fRx)*slider;
        const y = cy + M[1]*(xp-cx) + M[3]*(yp-cy) + (Ty + fRy)*slider;       
        ctx.beginPath();
        ctx.arc(CA_CX + x * CA_SX, CA_CY + y * CA_SY, RA * CA_SX, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
          if(!(b_v[0]==0 && b_v[1]==0)){
        const xp = (i + b_v[0]) * v1[0] + (j+b_v[1]) * v2[0] + (Tx + fRx)*slider;
        const yp = (i + b_v[0]) * v1[1] + (j+b_v[1]) * v2[1] + (Ty + fRy)*slider;
        const x2 = cx + M[0]*(xp-cx) + M[2]*(yp-cy) + (Tx + fRx)*slider;
        const y2 = cy + M[1]*(xp-cx) + M[3]*(yp-cy) + (Ty + fRy)*slider;               
        ctx.beginPath();
        ctx.arc(CA_CX + x2 * CA_SX, CA_CY + y2 * CA_SY, RB * CA_SX, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";      
        ctx.fill();}
      }
      }
      ctx.globalAlpha = 1      
  }
     
  if (showBasisVectors) {
  // Draw lattice vectors
  ctx.strokeStyle = "red";    
  ctx.beginPath();
  ctx.moveTo(CA_CX , CA_CY);
  ctx.lineTo(CA_CX + v1[0] * CA_SX, CA_CY + v1[1]* CA_SY);
  ctx.stroke();  
  
  ctx.beginPath();
  ctx.moveTo(CA_CX , CA_CY);
  ctx.lineTo(CA_CX + v2[0] * CA_SX, CA_CY + v2[1]* CA_SY);
  ctx.stroke();
  }
  if (showBasisVectorsCell) {
    // Draw lattice vectors
    ctx.strokeStyle = "blue";    
    ctx.beginPath();
    ctx.moveTo(CA_CX , CA_CY);
    ctx.lineTo(CA_CX + cv1[0] * CA_SX, CA_CY + cv1[1]* CA_SY);
    ctx.stroke();  
    
    ctx.beginPath();
    ctx.moveTo(CA_CX , CA_CY);
    ctx.lineTo(CA_CX + cv2[0] * CA_SX, CA_CY + cv2[1]* CA_SY);
    ctx.stroke();
    }  
  if (showwignerseitzcell && wignerSeitzVertices.length > 0) {
  // Draw the polygon using the Wigner-Seitz vertices
  ctx.beginPath();
  ctx.moveTo(CA_CX + wignerSeitzVertices[0][0] * CA_SX, CA_CY + wignerSeitzVertices[0][1] * CA_SY);
  for (let i = 1; i < wignerSeitzVertices.length; i++) {
    const vertex = wignerSeitzVertices[i];
    ctx.lineTo(CA_CX + vertex[0] * CA_SX, CA_CY + vertex[1] * CA_SY);
    }
  ctx.closePath();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.stroke();
  }

  if (showstandardcell) {
  // Draw the polygon using the Wigner-Seitz vertices
  ctx.beginPath();
  ctx.moveTo(CA_CX + standard_cell[0][0] * CA_SX, CA_CY + standard_cell[0][1] * CA_SY);
  for (let i = 1; i < standard_cell.length; i++) {
    const vertex = standard_cell[i];
    ctx.lineTo(CA_CX + vertex[0] * CA_SX, CA_CY + vertex[1] * CA_SY);
  }
  ctx.closePath();
  ctx.strokeStyle = "magenta";
  ctx.lineWidth = 2;
  ctx.stroke();
  }
}

function matriu_operacio_puntual(n,s){
  var ang=0;
  var refl=1;

  if(n==0){
    ang=0;
    refl=0;
  }else if(n==1){
    ang=2*3.1416;
    refl=0;
  }else if(n==2){
    ang=2*3.1416/2;
    refl=0;
  }else if(n==3){
    ang=2*3.1416/3;
    refl=0;
  }else if(n==4){
    ang=2*3.1416/4;
    refl=0;
  }else if(n==5){
    ang=2*3.1416/6;
    refl=0;
  }else if(n==6){
    ang=2*3.1416;
    refl=1;
  }else if(n==7){
    ang=2*3.1416/2;
    refl=1;
  }else if(n==8){
    ang=2*3.1416/3;
    refl=1;
  }else if(n==9){
    ang=2*3.1416/4;
    refl=1;
  }else if(n==10){
    ang=2*3.1416/6;
    refl=1;
  }  
  return [Math.cos(ang*s),Math.sin(ang*s),-Math.sin(ang*s)*(1-2*slider*refl),Math.cos(ang*s)*(1-2*slider*refl)];
  //return [0,0,0,0];  
}
  
function drawReciprocalLatticeVectors(ctx, v1, v2, b_v, RA, RB, ZA, ZB) {
//    const canvas = ctx.canvas;
 // const center = [canvas.width / 2, canvas.height / 2];
  let wignerSeitzVertices = [];
  if (showwignerseitzcell) {
    try {
      wignerSeitzVertices = calculateWignerSeitzVertices(v1, v2);
    } catch (e) {
      console.warn("No s'ha pogut calcular la cel·la de Wigner-Seitz (D3 no disponible?):", e);
    }
  }

  // Draw lattice points
  for (let i = -50; i <= 50; i++) {
    for (let j = -50; j <= 50; j++) {
      const x = i * v1[0] + j * v2[0];
      const y = i * v1[1] + j * v2[1];
      const DK = ((i * v1[0] + j * v2[0])**2+(i * v1[1] + j * v2[1])**2)**0.5;
      const fA = ZA * Math.exp (- 0.5 * RA**2 * DK**2 );
      const fB = ZB * Math.exp (- 0.5 * RB**2 * DK**2 );
      const fT = (fA**2 + fB**2 + 2*fA*fB*Math.cos((-b_v[0]*i-b_v[1]*j)))**0.5/(ZA+ZB);
      ctx.beginPath();
      ctx.arc(CB_CX + x * CB_SX, CB_CY + y * CB_SY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "black";
      ctx.globalAlpha = (fT);
      ctx.fill();

      if(b_v[0]!=0 & b_v[1]!=0){

      ctx.fill();    }    
      }
  }
  ctx.globalAlpha = (1);
  // Draw lattice vectors
  ctx.beginPath();
  ctx.moveTo(CB_CX, CB_CY);
  ctx.lineTo(CB_CX + v1[0] * CB_SX, CB_CY + v1[1] * CB_SY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CB_CX, CB_CY);
  ctx.lineTo(CB_CX + v2[0] * CB_SX, CB_CY + v2[1] * CB_SY);
  ctx.stroke();
  
  if (showwignerseitzcell && wignerSeitzVertices.length > 0) {
    // Draw the polygon using the Wigner-Seitz vertices
    ctx.beginPath();
    ctx.moveTo(CB_CX + wignerSeitzVertices[0][0] * CB_SX, CB_CY + wignerSeitzVertices[0][1] * CB_SY);
    for (let i = 1; i < wignerSeitzVertices.length; i++) {
      const vertex = wignerSeitzVertices[i];
      ctx.lineTo(CB_CX + vertex[0] * CB_SX, CB_CY + vertex[1] * CB_SY);
      }
    ctx.closePath();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
    }  
}


function drawMillerPlanes(ctx, v, spacing) {
  //const canvas = ctx.canvas;
//  const center = [canvas.width / 2, canvas.height / 2];

  const modv = Math.sqrt(v[0]**2 + v[1]**2)
  // Draw planes
    for (let i = -100; i <= 100; i++) {
      ctx.beginPath();
      ctx.moveTo(CA_CX + (v[1]/modv * 1000  + v[0]/modv* spacing * i) * CA_SX, CA_CY + (-v[0]/modv * 1000 + v[1]/modv* spacing * i) * CA_SY);
      ctx.lineTo(CA_CX + (-v[1]/modv*1000  + v[0]/modv* spacing * i) * CA_SX, CA_CY + (v[0]/modv *1000  + v[1]/modv* spacing * i) * CA_SY);
      ctx.stroke();
    }
}

// Store the inverse of the coefficient matrix
let inverseCoefficientMatrix = null;

// Function to calculate the coefficients of the closest reciprocal lattice point to the clicked position
function getClosestReciprocalPoint(mouseX, mouseY) {

  const scaledReciprocalV1 = [reciprocalV1[0] * CB_SX, reciprocalV1[1] * CB_SY];
  const scaledReciprocalV2 = [reciprocalV2[0] * CB_SX, reciprocalV2[1] * CB_SY];
//  const center = [canvas.width / 2, canvas.height / 2];

  const deltaX = mouseX - CB_CX;
  const deltaY = mouseY - CB_CY;

  const coefficientMatrix = [
    [scaledReciprocalV1[0], scaledReciprocalV2[0]],
    [scaledReciprocalV1[1], scaledReciprocalV2[1]]
  ];

  const inverseCoefficientMatrix = inverseMatrix(coefficientMatrix);

  const constantVector = [deltaX, deltaY];

  const coefficients = matrixVectorMultiply(inverseCoefficientMatrix, constantVector);

  // Round the coefficients to the nearest integer
  const roundedCoefficients = coefficients.map(coefficient => Math.round(coefficient));

  return roundedCoefficients;
}
// Function to calculate the product of a matrix and a vector
function matrixVectorMultiply(matrix, vector) {
  const result = [];
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    for (let j = 0; j < vector.length; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result.push(sum);
  }
  return result;
}

// Function to calculate the inverse of a 2x2 matrix
function inverseMatrix(matrix) {
  const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  const inverseDeterminant = 1 / determinant;
  const inverseMatrix = [
    [matrix[1][1] * inverseDeterminant, -matrix[0][1] * inverseDeterminant],
    [-matrix[1][0] * inverseDeterminant, matrix[0][0] * inverseDeterminant]
  ];
  return inverseMatrix;
}


// Retalla un poligon convex (llista de [x,y], en ordre) quedant-nos nomes
// amb la part que compleix a*x + b*y <= c (algorisme de Sutherland-Hodgman).
function clipPolygonHalfPlane(polygon, a, b, c) {
  const result = [];
  const n = polygon.length;
  const side = (p) => a * p[0] + b * p[1] - c;
  for (let k = 0; k < n; k++) {
    const curr = polygon[k];
    const prev = polygon[(k - 1 + n) % n];
    const dCurr = side(curr);
    const dPrev = side(prev);
    const currInside = dCurr <= 1e-9;
    const prevInside = dPrev <= 1e-9;
    if (currInside !== prevInside) {
      const t = dPrev / (dPrev - dCurr);
      result.push([prev[0] + t * (curr[0] - prev[0]), prev[1] + t * (curr[1] - prev[1])]);
    }
    if (currInside) result.push(curr);
  }
  return result;
}

// Cel·la de Wigner-Seitz al voltant de l'origen: interseccio dels semiplans
// "mes a prop de l'origen que del veí", per a cada punt veí de la xarxa.
// Calcul autocontingut (sense dependencies externes com D3).
function calculateWignerSeitzVertices(v1, v2) {
  let polygon = [[-100, -100], [100, -100], [100, 100], [-100, 100]];
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if (i === 0 && j === 0) continue;
      const nx = i * v1[0] + j * v2[0];
      const ny = i * v1[1] + j * v2[1];
      const normSq = nx * nx + ny * ny;
      if (normSq < 1e-12) continue;
      polygon = clipPolygonHalfPlane(polygon, nx, ny, normSq / 2);
      if (polygon.length === 0) return [];
    }
  }
  return polygon;
}

function calculatestandardcell(v1, v2) {

  // Extract the vertices of the polygon
  const vertices = [
    [-v1[0]/2-v2[0]/2, -v1[1]/2-v2[1]/2],
    [-v1[0]/2-v2[0]/2+v1[0], -v1[1]/2-v2[1]/2+v1[1]],
    [-v1[0]/2-v2[0]/2+v1[0]+v2[0], -v1[1]/2-v2[1]/2+v1[1]+v2[1]],
    [-v1[0]/2-v2[0]/2+v2[0], -v1[1]/2-v2[1]/2+v2[1]],        
  ]
  

  return vertices;
}





drawLattice();

// Redraw when lattice parameters change
document.getElementById("distanceA").addEventListener("input", drawLattice);
document.getElementById("distanceB").addEventListener("input", drawLattice);
document.getElementById("angle").addEventListener("input", drawLattice);
document.getElementById("millerIndex1").addEventListener("input", drawLattice);
document.getElementById("millerIndex2").addEventListener("input", drawLattice);
document.getElementById("showPlanes").addEventListener("change", drawLattice);
document.getElementById("showstandardcell").addEventListener("change", drawLattice);
document.getElementById("showwignerseitzcell").addEventListener("change", drawLattice);
document.getElementById("showbasisvectors").addEventListener("change", drawLattice);
document.getElementById("showbasiscellvec").addEventListener("change", drawLattice);
//document.getElementById("scale_r").addEventListener("input", drawLattice);

document.getElementById("RA").addEventListener("input", drawLattice);
document.getElementById("ZA").addEventListener("input", drawLattice);
document.getElementById("RB").addEventListener("input", drawLattice);
document.getElementById("ZB").addEventListener("input", drawLattice);
document.getElementById("b1").addEventListener("input", drawLattice);
document.getElementById("b2").addEventListener("input", drawLattice);
document.getElementById("canvas2").addEventListener("click", handleDebouncedEvent);

document.getElementById("canvas_a_scale_x").addEventListener("input", drawLattice);
document.getElementById("canvas_a_scale_y").addEventListener("input", drawLattice);
document.getElementById("canvas_a_center_x").addEventListener("input", drawLattice);
document.getElementById("canvas_a_center_y").addEventListener("input", drawLattice);
document.getElementById("canvas_b_scale_x").addEventListener("input", drawLattice);
document.getElementById("canvas_b_scale_y").addEventListener("input", drawLattice);
document.getElementById("canvas_b_center_x").addEventListener("input", drawLattice);
document.getElementById("canvas_b_center_y").addEventListener("input", drawLattice);

document.getElementById("sc1v1").addEventListener("input", drawLattice);
document.getElementById("sc1v2").addEventListener("input", drawLattice);
document.getElementById("sc2v1").addEventListener("input", drawLattice);
document.getElementById("sc2v2").addEventListener("input", drawLattice);

document.getElementById("showSymmetry").addEventListener("change", drawLattice);
document.getElementById("Roperation").addEventListener("change", drawLattice);
document.getElementById("cx").addEventListener("input", drawLattice);
document.getElementById("cy").addEventListener("input", drawLattice);
document.getElementById("Tx").addEventListener("input", drawLattice);
document.getElementById("Ty").addEventListener("input", drawLattice);
document.getElementById("fRx").addEventListener("input", drawLattice);
document.getElementById("fRy").addEventListener("input", drawLattice);
document.getElementById("slider").addEventListener("input", drawLattice);

// ═══════════════════════════════════════════════════
//  Targetes de controls plegables
// ═══════════════════════════════════════════════════
document.querySelectorAll('.collapsible-title').forEach(function(title) {
  title.addEventListener('click', function() {
    var card = this.closest('.card');
    var tri  = this.querySelector('.card-tri');
    card.classList.toggle('collapsed');
    tri.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
  });
});