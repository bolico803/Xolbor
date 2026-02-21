const express = require('express');
const path = require('path');
const app = express();

const PORT = 300;

// Serve static files from the current directory
app.use(express.static(__dirname));

// For SPA routing (if needed later)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Quantum Browser is running at http://localhost:${PORT}`);
    console.log(`Note: If port ${PORT} is restricted on your system, you might need to run as administrator or change the port in server.js.`);
});
