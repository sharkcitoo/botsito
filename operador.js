const mineflayer = require('mineflayer');
const config = require('./settingsss.json'); // Usa un config aparte si quieres
const operador = mineflayer.createBot({
   host: config.server.ip,
   port: config.server.port,
   username: 'OperadorBot',
   auth: 'offline', // o 'offline' según el servidor
   version: config.server.version
});

operador.once('spawn', () => {
   console.log('Operador conectado al servidor');

   // Autenticarse si es necesario
   setTimeout(() => {
      operador.chat('/login tu_contraseña'); // si hay login
   }, 1000);

   // Esperar y luego perdonar
   setTimeout(() => {
      operador.chat('/pardon BOTSITO_SHARK');
      console.log('Comando /pardon enviado');

      setTimeout(() => {
         operador.quit(); // salir del servidor
         console.log('Operador se desconectó');
      }, 3000);
   }, 5000);
});
