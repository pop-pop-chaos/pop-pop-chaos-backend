const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Simple hello world route
app.get('/', (req, res) => {
    res.send('Hello World! Welcome to Pop Pop Chaos Backend.');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
