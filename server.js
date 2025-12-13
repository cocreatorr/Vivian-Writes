require('dotenv').config();
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Backend running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
