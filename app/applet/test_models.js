import https from 'https';

const checkModel = (modelId) => {
  return new Promise((resolve) => {
    https.get(`https://openrouter.ai/api/v1/models`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        const models = json.data.map(m => m.id);
        const exact = models.find(m => m === modelId);
        const fuzzy = models.filter(m => m.toLowerCase().includes('failspy') || m.toLowerCase().includes('ablit') || m.toLowerCase().includes('oblit'));
        resolve({ exact, fuzzy });
      });
    });
  });
};

checkModel('failspy/llama-3-70b-instruct-abliterated').then(console.log);
