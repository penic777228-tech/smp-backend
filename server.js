const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const ftp = require('basic-ftp');

const app = express();
app.use(cors());
app.use(express.json());

// Dočasné úložiště objednávek v paměti (není potřeba databáze)
const orders = new Map();

// ⚠️ SEM VLOŽ SVOJE ÚDAJE Z ATERNOSU (Soubory → FTP přístup)
const FTP_CONFIG = {
  host: 'aternos.org',       // nebo IP
  user: 'tvoje_ftp_jmeno',
  password: 'tvoje_ftp_heslo',
  secure: false
};

async function uploadOrderFile(token, nickname, rankId, price) {
  const client = new ftp.Client();
  try {
    await client.access(FTP_CONFIG);
    await client.ensureDir('/orders');
    const orderData = JSON.stringify({
      token,
      nickname,
      rankId,
      price,
      created: Date.now()
    });
    await client.uploadFrom(require('stream').Readable.from([orderData]), `${token}.json`);
    console.log(`✅ Soubor ${token}.json nahrán.`);
  } catch (err) {
    console.error('❌ FTP chyba:', err);
    throw new Error('Nelze nahrát objednávku na server');
  } finally {
    client.close();
  }
}

app.post('/api/create-order', async (req, res) => {
  const { nickname, password, rankId, price } = req.body;
  if (!nickname || !password || !rankId || !price) {
    return res.status(400).json({ error: 'Chybějící údaje' });
  }

  const token = crypto.randomBytes(6).toString('hex');
  const createdAt = Date.now();

  // Uložení do paměti (pro případné pozdější ověření)
  orders.set(token, {
    nickname,
    passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
    rankId,
    price,
    createdAt
  });

  try {
    await uploadOrderFile(token, nickname, rankId, price);
    // Po 30 sekundách automaticky smažeme z paměti
    setTimeout(() => orders.delete(token), 30000);
    res.json({ token });
  } catch (ftpErr) {
    orders.delete(token);
    res.status(500).json({ error: ftpErr.message });
  }
});

// Volitelný endpoint pro ruční potvrzení (nepovinné)
app.post('/api/confirm-order', (req, res) => {
  const { token } = req.body;
  if (!orders.has(token)) return res.status(404).json({ error: 'Neplatný token' });
  const order = orders.get(token);
  if (Date.now() - order.createdAt > 30000) {
    orders.delete(token);
    return res.status(410).json({ error: 'Objednávka vypršela' });
  }
  orders.delete(token);
  res.json({ success: true, price: order.price, rankId: order.rankId, nickname: order.nickname });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Backend běží na portu ${port}`));
