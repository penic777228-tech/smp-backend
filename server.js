const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ SEM NAPIŠ SVOJE TAJNÉ HESLO (stejné dáš do shop.sk)
const SECRET_KEY = 'mujSuperTajnyKlic2024';

app.post('/api/create-order', (req, res) => {
  const { nickname, rankId, price } = req.body;
  if (!nickname || !rankId || !price) {
    return res.status(400).json({ error: 'Chybí údaje' });
  }

  const exp = Date.now() + 30000; // 30 sekund
  const data = `${nickname}:${rankId}:${price}:${exp}`;
  const hash = crypto
    .createHash('sha256')
    .update(data + SECRET_KEY)
    .digest('hex');

  const token = `${data}:${hash}`;
  res.json({ token });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Backend běží na portu ${port}`));
