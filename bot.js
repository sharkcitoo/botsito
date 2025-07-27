const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');

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
      console.log("Bot joined to the server");

      if (config.utils['auto-auth'].enabled) {
         console.log('Auto-auth module active');
         const password = config.utils['auto-auth'].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 500);
      }

      if (config.utils['chat-messages'].enabled) {
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

      const pos = config.position;
      if (pos.enabled) {
         console.log(`Moving to: ${pos.x}, ${pos.y}, ${pos.z}`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
         if (config.utils['anti-afk'].jump) bot.setControlState('jump', true);
      }
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         console.log(`<${username}> ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      console.log(`Goal reached at ${bot.entity.position}`);
   });

   bot.on('death', () => {
      console.warn(`Bot died at ${bot.entity.position}`);
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         console.warn('Bot disconnected. Reconnecting...');
         setTimeout(createBot, config.utils['auto-reconnect-delay'] || 10000);
      });
   }

   bot.on('kicked', async (reason) => {
      let reasonText = '';
      try {
         const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason;
         reasonText = parsed.text || parsed.extra?.[0]?.text || JSON.stringify(parsed);
         reasonText = reasonText.replace(/§./g, '');
      } catch {
         reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
      }

      console.warn(`Bot was kicked. Reason: ${reasonText}`);

      if (reasonText.toLowerCase().includes('ban')) {
         console.warn('Bot was banned, trying to unban...');
         try {
            await desbanearBot();
            console.log('Bot unbanned, reconnecting...');
         } catch (err) {
            console.error('Error unbanning bot: ' + err.message);
         }

         setTimeout(createBot, 5000);
      }
   });

   bot.on('error', (err) => {
      console.error(`Bot error: ${err.message}`);
   });
}

async function desbanearBot() {
   return new Promise((resolve, reject) => {
      const botOp = mineflayer.createBot({
         username: config['bot-op-account']['username'],
         password: config['bot-op-account']['password'],
         auth: config['bot-op-account']['type'],
         host: config.server.ip,
         port: config.server.port,
         version: config.server.version,
      });

      botOp.once('spawn', () => {
         console.log('Bot OP connected to unban');
         botOp.chat(`/pardon ${config['bot-account']['username']}`);
         botOp.quit();
         resolve();
      });

      botOp.on('error', (err) => {
         console.error('Bot OP error: ' + err.message);
         reject(err);
      });
   });
}

createBot();
