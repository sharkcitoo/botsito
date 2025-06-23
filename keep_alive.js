var http = require('http');

http.createServer(function (req, res) {
  res.write("Estoy vivo");
  res.end();
}).listen(8080);
