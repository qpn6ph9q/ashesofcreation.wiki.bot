const {
	Client,
	MessageEmbed,
	Emoji,
	MessageReaction	
} = require('discord.js');
const client = new Client();
const base_config = require('./config.json');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

function ucFirst(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function setActivity() {
	client.user.setActivity(` on ${client.guilds.cache.size} discords | +help`, { type: 'PLAYING' })
}

function uriWikiEncode(uri) {
	uri = ucFirst(uri);
	uri = uri.replace(/ /g, '_');
	uri = uri.replace(/&/g, '%26');
	uri = uri.replace(/\//g, '%2F');
	uri = uri.replace(/=/g, '%3D');
	uri = uri.replace(/\?/g, '%3F');
	return uri;
}

client.on('ready', () => {
	console.log(`Bot starting in ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);
	setActivity();
});

client.on('guildCreate', guild => {
	console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
	setActivity();
});

client.on('guildDelete', guild => {
	console.log(`Bot leaving ${guild.name}`);
	setActivity();
});

global.timestamp = {};

client.on('message', async message => {
	if (message.author.bot)
		return;
	const config = message.member.guild.id in base_config ? base_config[message.member.guild.id] : base_config;
	const content = message.content === '+help' ? `${config.prefix}help` : message.content;
	if (content.indexOf(config.prefix) !== 0)
		return;
	if(config.command_cooldown && global.timestamp[message.channel.id] && message.createdTimestamp - global.timestamp[message.channel.id] < config.command_cooldown) {
		const m = await message.channel.send(`Command cooldown is in effect. ${Math.floor((config.command_cooldown - (message.createdTimestamp - global.timestamp[message.channel.id]))/1000)} seconds remaining`);
		setTimeout(() => {
			m.delete();
		}, 2000);
	   	return;
	}	
	global.timestamp[message.channel.id] = message.createdTimestamp;
	const args = content.slice(config.prefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();

	if (command === 'ping') {
		const m = await message.channel.send('test');
		m.edit(`Ping latency: ${m.createdTimestamp - message.createdTimestamp}ms. API Latency: ${Math.round(client.ping)}ms`);
	}
	else if (command === 'wiki') {
		const search = args.join(' ');
		if (search == '') {
			message.channel.send('https://ashesofcreation.wiki');
			return;
		}
		const xhr = new XMLHttpRequest();
		xhr.addEventListener('load', () => {
			var response = xhr.responseText;
			if (!response) {
				message.channel.send(`https://ashesofcreation.wiki/${uriWikiEncode(search)}`)
					.catch(err => {
						console.log(err);
					});
				return;
			}
			const json = JSON.parse(response);
			if (!json) {
				message.channel.send('Missing response. Try again later.');
				return;
			}
			const result = json.__main__.result;
			if (!result) {
				message.channel.send('Invalid response format. Try again later.');
				return;
			}
			if (!result.hits) {
				message.channel.send('No matching results. Try something else.');
				return;
			}
			if (!result.hits.total) {
				message.channel.send(`${args.join(' ')} not found. Try something else.`);
				return;
			}
			if (result.hits.total == 1) {
				message.channel.send(`https://ashesofcreation.wiki/${uriWikiEncode(result.hits.hits[0]._source.title)}`)
					.catch(err => {
						console.log(err);
					});
				return;
			}
			result.hits.hits.length = 3;
			const embed = new MessageEmbed().setTitle(`${command} results`).setColor('#e69710');
			let count = 1;
			for(const hit of result.hits.hits) {
				let m = hit.highlight.text.toString();
				m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
				m = m.replace(/\uE000([^\uE001]+)\uE001/g, '***$1***');
				m = m.replace(/<[^>]+>/g, '');
				embed.addField(`${count}: <https://ashesofcreation.wiki/${uriWikiEncode(hit._source.title)}>`,`...${m}...`);
				count++;
			};
			message.channel.send(embed)
				.catch(err => {
					console.log(err);
				});				
		});
		const query = 'https://ashesofcreation.wiki/Special:Search?cirrusDumpResult=&search=' + uriWikiEncode(search);
		xhr.open('GET', query, false);
		xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');	
		xhr.send();
	}
        else if (command === 'random') {
                const xhr = new XMLHttpRequest();
                xhr.addEventListener('load', () => {
                        const location = xhr.getResponseHeader('location');
                        message.channel.send(location ? location : 'Random page not available. Try again later.');
                });
                xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
                xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
                xhr.send();
        }
        else if (command === 'quiz') {
		message.channel.send('https://quiz.ashesofcreation.wiki/');
        }
	else if (command === 'help') {
		const embed = new MessageEmbed()
			.setTitle(`** ashesofcreation.wiki Discord bot **`)
			.setColor('#e69710')
			.setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
			.addField(`\`\`${config.prefix}wiki TEXT\`\``,`Search ashesofcreation.wiki for TEXT (top 3 results)`)
			.addField(`\`\`${config.prefix}random\`\``,`Random article from  ashesofcreation.wiki`)
			.addField(`\`\`${config.prefix}quiz\`\``,`Take the Ashes of Creation Trivianator quiz`)
			.addField('Join our discord!', 'https://discord.gg/HEKx527')
			.addField('Invite me to your discord!', 'https://goo.gl/DMB3Sr');
		if(config.command_cooldown)
			embed.setFooter(`Command cooldown is set to ${config.command_cooldown/1000} seconds`);		
		message.channel.send(embed)
			.catch(err => {
				console.log(err);
			});				
	}
});
client.login(base_config.token);
