const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');

const loggers = require('./logging.js');
const logger = loggers.logger;

const keep_alive = require('./keep_alive.js');

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

      // Chat messages module
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
         logger.info(`Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      // Anti-AFK
      if (config.utils['anti-afk'].enabled) {
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }
         if (config.utils['anti-afk'].jump) {
            bot.setControlState('jump', true);
         }
      }
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         logger.info(`<${username}> ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      logger.info(`Bot arrived to target location. ${bot.entity.position}`);
   });

   bot.on('death', () => {
      logger.warn(`Bot died and respawned at ${bot.entity.position}`);
   });

   // Auto reconnect
   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         logger.warn('Bot disconnected. Reconnecting...');
         setTimeout(() => {
            createBot();
         }, config.utils['auto-reconnect-delay'] || 10000);
      });
   }

   // Safe handling of kick reason
   bot.on('kicked', (reason) => {
      let reasonText = '';

      try {
         const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason;

         if (typeof parsed.text === 'string') {
            reasonText = parsed.text;
         } else if (Array.isArray(parsed.extra) && parsed.extra[0]?.text) {
            reasonText = parsed.extra[0].text;
         } else {
            reasonText = JSON.stringify(parsed);
         }

         reasonText = reasonText.replace(/§./g, '');
      } catch (e) {
         reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      }

      logger.warn(`Bot was kicked from the server. Reason: ${reasonText}`);
   });

   bot.on('error', (err) => {
      logger.error(`Error: ${err.message}`);
   });
}

createBot();
