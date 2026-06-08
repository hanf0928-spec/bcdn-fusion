'use strict';

// Manually re-run schema initialization (idempotent)
try { require('dotenv').config(); } catch (_) {}
require('../db');
console.log('✅ database initialized.');
