global.timestamp = {};

import config from './config.json';

import { Client, Intents } from 'discord.js';

global.client = new Client({
    intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES ]
});

import { setActivity } from './utils.js';

import initSlashCommands from './slashCommands.js';

//import dispatcher from './messageCommands.js';

try {
    if (config.topggtoken) {
        import ('topgg-autoposter').then(topgg => {
	  const ap = topgg.AutoPoster(config.topggtoken, global.client);
          ap.on('posted', () => {
            //console.log('Posted stats to top.gg');
          });
	});
    }
} catch (e) {
    console.error({
        topgg_exception: e
    });
}

global.client.on('ready', async () => {
    try {
        console.log(`Bot starting in ${global.client.guilds.cache.size} servers with ${global.client.users.cache.size} users`);
        setActivity();
        initSlashCommands();
    }
    catch (e) {
        console.error({
            event: 'ready',
            e
        });
    }
});
global.client.on('guildCreate', async guild => {
    try {
        console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
        setActivity();
    }
    catch (e) {
        console.error({
            event: 'guildCreate',
            guild,
            e
        });
    }
});
global.client.on('guildDelete', async guild => {
    try {
        console.log(`Bot leaving ${guild.name}`);
        setActivity();
    }
    catch (e) {
        console.error({
            event: 'guildDelete',
            guild,
            e
        });
    }
});

global.client.login(config.token);
