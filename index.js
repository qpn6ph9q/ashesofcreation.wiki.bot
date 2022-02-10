global.timestamp = {};

import config from './config.json';

import { Client, Intents } from 'discord.js';

global.client = new Client({
    intents: [ Intents.FLAGS.GUILD_MESSAGES ]
});

import { setActivity } from './utils.js';

import initSlashCommands from './slashCommands.js';

import dispatcher from './messageCommands.js';

try {
    if (config.topggtoken) {
        const topgg = require('topgg-autoposter')
        const ap = topgg(config.topggtoken, global.client);
        ap.on('posted', () => {
            //console.log('Posted stats to top.gg');
        });
    }
} catch (e) {
    console.error({
        topgg_exception: e
    });
}

global.client.on('ready', () => {
    console.log(`Bot starting in ${global.client.guilds.cache.size} servers with ${global.client.users.cache.size} users`);
    setActivity();
    initSlashCommands();
});
global.client.on('guildCreate', guild => {
    console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
    setActivity();
});
global.client.on('guildDelete', guild => {
    console.log(`Bot leaving ${guild.name}`);
    setActivity();
});
client.on('message', async message => {
    await dispatcher(message).catch((e) => {
        console.error({
            dispatcher: e
        });
    });
});
global.client.login(config.token);
