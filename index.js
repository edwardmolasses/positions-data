const express = require('express')
// const path = require('path')
const PORT = 5003
const app = express(); //Line 2
const path = __dirname + '/public/views/';

app.use(express.static(path));
// app.get('/', (req, res) => res.render('index.html'));

app.get('/', function (req, res) {
  res.sendFile(path + "index.html");
});

// create a GET route
app.get('/express_backend', (req, res) => { //Line 9
  res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' }); //Line 10
}); //Line 11

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
