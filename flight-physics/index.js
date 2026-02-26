// Flight Physics Module
// Phase 1: Custom flight dynamics with altitude-dependent air density and wind

export { 
  ATLAS_CONFIG, 
  DEV_CONFIG, 
  getTotalMass, 
  getDiskArea 
} from './drone-config.js';

export { 
  getAtmosphere, 
  getAirDensity, 
  getGravity 
} from './atmosphere.js';

export { 
  WindModel, 
  CALM, 
  MODERATE, 
  STRONG, 
  BEU_FIRE 
} from './wind-model.js';

export { 
  calculateThrust, 
  hoverThrottle, 
  calculateDragMagnitude, 
  computeForces,
  checkHoverCapability 
} from './forces.js';
