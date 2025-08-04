const mineflayer = require('mineflayer');
const { Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const mcDataLoader = require('minecraft-data');
const config = require('./settings.json');

// Nomes aleatórios para reconectar
const nicknames = ["Miguel", "Gabriel", "Lucca", "João", "Davi", "Pedro", "Enzo", "Henrique", "Theo", "Gustavo"];
let nicknameIndex = 0;

// Web server para manter o Replit ativo
const express = require('express');
const keepAlive = express();
const PORT = process.env.PORT || 3000;
keepAlive.get("/", (req, res) => res.send("Bot ativo!"));
keepAlive.listen(PORT, () => console.log("✅ Servidor web rodando no Replit"));

// Gerar nick aleatório
function getNextUsername() {
  const name = nicknames[nicknameIndex % nicknames.length] + Math.floor(Math.random() * 1000);
  nicknameIndex++;
  return name;
}

function createBot() {
  const bot = mineflayer.createBot({
    username: getNextUsername(),
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  const mcData = mcDataLoader(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.settings.colorsEnabled = false;

  bot.once('spawn', () => {
    console.log('\x1b[33m[AfkBot] Conectado ao servidor', '\x1b[0m');

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages']['messages'];
      if (config.utils['chat-messages'].repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, config.utils['chat-messages']['repeat-delay'] * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    if (config.position.enabled) {
      const pos = config.position;
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
    console.log(`\x1b[32m[AfkBot] Chegou no destino: ${bot.entity.position}\x1b[0m`);
  });

  bot.on('death', () => {
    console.log(`\x1b[33m[AfkBot] Morreu. Respawn: ${bot.entity.position}\x1b[0m`);
  });

  bot.on('kicked', reason => {
    console.log(`\x1b[33m[AfkBot] Kickado: ${reason}\x1b[0m`);
  });

  bot.on('error', err => {
    console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`);
  });

  bot.on('end', () => {
    if (config.utils['auto-reconnect']) {
      console.log('[INFO] Desconectado. Reconectando com novo nick...');
      const delay = Number(config.utils['auto-reconnect-delay']) || 5000;
      setTimeout(createBot, delay);

    }
  });
}

createBot();
