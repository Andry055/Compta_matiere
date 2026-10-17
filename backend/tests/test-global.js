'use strict';

// Test if we can set and access a global variable
global.testGlobal = 'hello world';

console.log('global.testGlobal:', global.testGlobal);

// Now require the controller and see if it can access it
const path = require('node:path');
const CONTROLEUR = path.join(__dirname, '..', 'src', 'api', 'sortie', 'controllers', 'sortie.js');

try {
  const controleur = require(CONTROLEUR);
  console.log('Controller required successfully');
} catch (e) {
  console.log('Error requiring controller:', e.message);
}