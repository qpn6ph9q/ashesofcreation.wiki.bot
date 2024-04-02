import { createRequire } from "module";
const require = createRequire(import.meta.url);
import config from './config.json';
import { Client, IntentsBitField } from 'discord.js';
import initSlashCommands from './slashCommands.js';

function setActivity() {
	global.client.user.setActivity(` on ${global.client.guilds.cache.size} discords | +help`, {
		type: 'PLAYING'
	})
}

global.timestamp = {};

global.client = new Client({
	intents: new IntentsBitField().add(IntentsBitField.Flags.Guilds)
});
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
