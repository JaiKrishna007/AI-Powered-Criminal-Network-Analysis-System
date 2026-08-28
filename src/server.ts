import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend Developer 2 service running on port ${PORT} [PS26189-CONTRACT-v1]`);
});
