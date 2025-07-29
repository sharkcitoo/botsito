const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;
const keep_alive = require('./keep_alive.js');
const { spawn } = require('child_process');

// 🕒 Obtener hora actual como string (formato 24h)
function getTimeString() {
   const now = new Date();
   return now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Mexico_City' }); // ajusta si no estás en CDMX
}

// 🚫 Evitar reconectar entre 19:00 y 19:10
function shouldReconnect() {
   const now = new Date();
   const h = now.getHours();
   const m = now.getMinutes();
   return !(h === 19 && m < 10);
}

// ⏱ Desconectar automáticamente a las 19:00
function autoDisconnectBot(bot) {
   setInterval(() => {
      const time = getTimeString();
      if (time >= "19:00:00" && time <= "19:10:00") {
         console.log(`[${time}] Desconectando bot para evitar detección por Aternos.`);
         bot.quit('Desconexión diaria programada');
      }
   }, 60 * 1000); // revisar cada minuto
}

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   bot.once('spawn', () => {
      logger.info("Bot joined to the server");

      // Auto-auth module
      if (config.utils['auto-auth'].enabled) {
         logger.info('Started auto-auth module');
         const password = config.utils['auto-auth'].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
            logger.info('Authentication commands executed');
         }, 500);
      }

      // Chat messages
      if (config.utils['chat-messages'].enabled) {
         logger.info('Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            setInterval(() => {
               bot.chat(messages[i]);
               i = (i + 1) % messages.length;
            }, delay * 1000);
         } else {
            messages.forEach((msg) => bot.chat(msg));
         }
      }

      // Auto movement
      const pos = config.position;
      if (config.position.enabled) {
         logger.info(`Moving to target location (${pos.x}, ${pos.y}, ${pos.z})`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      // Anti-AFK
      if (config.utils['anti-afk'].enabled) {
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
         if (config.utils['anti-afk'].jump) bot.setControlState('jump', true);
      }

      // Activar auto-desconexión diaria
      autoDisconnectBot(bot);
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         logger.info(`<${username}> ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      logger.info(`Bot arrived at ${bot.entity.position}`);
   });

   bot.on('death', () => {
      logger.warn(`Bot died and respawned at ${bot.entity.position}`);
   });

   // Auto reconnect
   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         logger.warn('Bot disconnected. Reconnecting...');
         setTimeout(() => {
            if (shouldReconnect()) {
               createBot();
            } else {
               logger.warn('Reconexión bloqueada por horario de apagado diario.');
            }
         }, config.utils['auto-reconnect-delay'] || 10000);
      });
   }

   bot.on('kicked', (reason) => {
      let reasonText = '';
      try {
         const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason;
         if (typeof parsed.text === 'string') reasonText = parsed.text;
         else if (Array.isArray(parsed.extra) && parsed.extra[0]?.text) reasonText = parsed.extra[0].text;
         else reasonText = JSON.stringify(parsed);

         reasonText = reasonText.replace(/§./g, '');
      } catch (e) {
         reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      }

      logger.warn(`Bot was kicked. Reason: ${reasonText}`);
      spawn('node', ['operador.js'], { stdio: 'inherit' });
   });

   bot.on('error', (err) => {
      logger.error(`Error: ${err.message}`);
   });
}

createBot();
