global.timestamp = {};

import config from './config.json';

import { Client, Intents } from 'discord.js';

global.client = new Client({
	intents: [Intents.FLAGS.GUILDS]
});

import { setActivity } from './utils.js';

import initSlashCommands from './slashCommands.js';

try {
	if (config.topggtoken) {
		const topgg = require('topgg-autoposter')
		const ap = topgg(config.topggtoken, global.client);
		ap.on('posted', () => {});
	}
} catch (e) {
	console.error({
		topgg_exception: e
	});
}

global.client.on('ready', async () => {
	console.log(`Bot starting in ${global.client.guilds.cache.size} servers with ${global.client.users.cache.size} users`);
	setActivity();
	initSlashCommands();
});
global.client.on('guildCreate', async guild => {
	console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
	setActivity();
});
global.client.on('guildDelete', async guild => {
	console.log(`Bot leaving ${guild.name}`);
	setActivity();
});

global.client.login(config.token);