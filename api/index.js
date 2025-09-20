// Ultra simple Vercel function
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.status(200).json({
    status: 'OK',
    message: 'Real-time Chat API - Vercel Serverless',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
};
