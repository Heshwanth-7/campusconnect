import { app } from './app.ts';

import { qrSecret } from './utils/qr-token.ts';

qrSecret();
app.listen(3000, '127.0.0.1', () => {
  console.log('CampusConnect API listening on http://127.0.0.1:3000');
});
