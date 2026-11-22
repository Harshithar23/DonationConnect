export function notFound(req, res) { res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }); }
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.name === 'ValidationError') return res.status(400).json({ message: 'Validation failed.', details: Object.values(err.errors).map(e => e.message) });
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier or value.' });
  if (err?.code === 11000) return res.status(409).json({ message: 'A record with this value already exists.' });
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Unexpected server error.' });
}
