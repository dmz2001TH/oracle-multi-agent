/**
 * Serve Dashboard HTML
 * From Soul-Brews WebSocket Dashboard + MAW Guide
 */

import express from 'express';
import { join } from 'path';

const app = express();
const PORT = 3456;

// Serve dashboard directory
app.use(express.static(join(__dirname, '../dashboard')));

app.listen(PORT, () => {
  console.log(`[ServeDashboard] Dashboard served at http://localhost:${PORT}/index.html`);
});
