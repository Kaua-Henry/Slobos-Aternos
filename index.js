const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot has arrived'));
app.listen(8000, () => console.log('Server started'));

let botCounter = 1;

function generateUsername() {
  return config['bot-account']['username'] + '_' + botCounter++;
}

function createBot() {
   const botUsername = generateUsername();

   const bot = mineflayer.createBot({
      username: botUsername,
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

   let pendingPromise = Promise.resolve();

   function sendRegister(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/register ${password} ${password}`);
         console.log(`[Auth] Sent /register command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);

            if (message.includes('successfully registered')) {
               resolve();
            } else if (message.includes('already registered')) {
               resolve();
            } else {
               reject(`Registration failed: ${message}`);
            }
         });
      });
   }

   function sendLogin(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Sent /login command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);

            if (message.includes('successfully logged in')) {
               resolve();
            } else if (message.includes('Invalid password')) {
               reject(`Login failed: Invalid password. Message: "${message}"`);
            } else if (message.includes('not registered')) {
               reject(`Login failed: Not registered. Message: "${message}"`);
            } else {
               reject(`Login failed: ${message}`);
            }
         });
      });
   }

   bot.once('spawn', () => {
      console.log(`\x1b[33m[AfkBot] ${bot.username} joined the server\x1b[0m`);

      if (config.utils['auto-auth'].enabled) {
         const password = config.utils['auto-auth'].password;
         pendingPromise = pendingPromise
            .then(() => sendRegister(password))
            .then(() => sendLogin(password))
            .catch(error => console.error('[ERROR]', error));
      }

      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages']['messages'];
         const delay = config.utils['chat-messages']['repeat-delay'];
         let i = 0;

         setInterval(() => {
            bot.chat(messages[i]);
            i = (i + 1) % messages.length;
         }, delay * 1000);
      }

      const pos = config.position;
      if (pos.enabled) {
         console.log(`\x1b[32m[AfkBot] Moving to (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         bot.setControlState('jump', true);
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }
      }
   });

   bot.on('goal_reached', () => {
      console.log(`\x1b[32m[AfkBot] Bot arrived at location ${bot.entity.position}\x1b[0m`);
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[AfkBot] Bot died and respawned at ${bot.entity.position}\x1b[0m`);
   });

   bot.on('kicked', (reason) => {
      console.log(`\x1b[33m[AfkBot] Kicked: ${reason}\x1b[0m`);
   });

   bot.on('end', () => {
      if (config.utils['auto-reconnect']) {
         console.log(`[INFO] Reconnecting with new nick...`);
         setTimeout(() => createBot(), config.utils['auto-recconect-delay']);
      }
   });

   bot.on('error', (err) =>
      console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`)
   );
}

createBot();
