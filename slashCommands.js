import { createRequire } from "module";
const require = createRequire(import.meta.url);
import config from './config.json';

import { REST, Routes, EmbedBuilder, Collection } from 'discord.js';

import { SlashCommandBuilder } from '@discordjs/builders';

import { XMLHttpRequest } from 'xmlhttprequest';

import { ucFirst, uriWikiEncode, getPageEmbed, embedPage, prepareMessageContent } from './utils.js';

const cooldown = async (interaction) => {
	if (!interaction?.member) {
		console.error('invalid_interaction', interaction);
		return true;
	}
	if (config.immune && config.immune.includes(interaction.member.id)) return false;
	const cd = Math.floor((config.command_cooldown - (interaction.createdTimestamp - global.timestamp[interaction.channelId])) / 1000);
	if (config.command_cooldown && cd > 0) {
		const m = await interaction.reply(await prepareMessageContent(`Command cooldown is in effect. ${cd} seconds remaining`))
		return true;
	}
	global.timestamp[interaction.channelId] = interaction.createdTimestamp;
	return false;
};

export async function initSlashCommands() {
	const rest = new REST().setToken(config.token);
	if (!rest) {
		console.error('Rest API is not enabled.');
		return;
	}
	const wiki = async (interaction, ephemeral, max_results = 3) => {
		if (await cooldown(interaction)) return;
		await interaction.deferReply({ ephemeral });
		const search = interaction.options.getString('search');
		if (!search) return await interaction.editReply(await prepareMessageContent(await getPageEmbed('Ashes of Creation Wiki')));
		try {
			return await interaction.editReply(await prepareMessageContent(await getPageEmbed(search)));
		} catch (e) {
			console.log('no exact match found for %s: %s', search, e);
		}
		const query = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=&list=search&srsearch=${uriWikiEncode(search)}&formatversion=2&&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet%7Csectiontitle%7Csectionsnippet&srenablerewrites=1`;
		const xhr = new XMLHttpRequest();
		await xhr.open('GET', query, false);
		xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
		await xhr.send(null);
		if (xhr.readyState != 4) return await interaction.editReply(await prepareMessageContent('Page not found. Please try again later.'));
		const response = xhr.responseText;
		if (!response) return await interaction.editReply(await prepareMessageContent(await embedPage(search))).catch(err => {
			console.error(err);
		});
		let location = xhr.getResponseHeader('location');
		if (location) return await interaction.editReply(await prepareMessageContent(await embedPage(location)));
		const json = JSON.parse(response);
		if (!json || !json.query || !json.query.search) return await interaction.editReply(await prepareMessageContent('Missing response. Try again later.'));
		const result = json.query.search;
		if (!result) return await interaction.editReply(await prepareMessageContent('Invalid response format. Try again later.'));
		if (!result.length) return await interaction.editReply(await prepareMessageContent('No matching results. Try something else.'));
		if (result.length == 1) {
			return await interaction.editReply(await prepareMessageContent(await embedPage(result[0].title, result[0].sectiontitle))).catch(err => {
				console.error(err);
			});
		}
		result.length = max_results;
		const embed = new EmbedBuilder()
			.setTitle(`Ashes of Creation Wiki search results`)
			.setColor('#e69710');
		let count = 1;
		for (const hit of result) {
			if (!hit?.title) continue;
			let m = hit.snippet.toString();
			m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
			m = m.replace(/\uE000([^\uE001]+)\uE001/g, '***$1***');
			m = m.replace(/<[^>]+>/g, '');
			m = m.replace(/&quot;/g, '"');
			m = m.replace(/&amp;/g, '&');
			embed.addFields({ name: `${count}: <https://ashesofcreation.wiki/${uriWikiEncode(hit.title, hit.sectiontitle)}>`, value: `...${m}...` });
			count++;
		};
		await interaction.editReply(await prepareMessageContent(count == 1 ? 'Something went wrong. Try again later.' : embed)).catch(err => {
			console.error(err);
		});
	};
	global.client.commands = new Collection();
	try {
		const globalSlashCommands = [
			{
				data: new SlashCommandBuilder().setName('wiki')
					.setDescription('Search ashesofcreation.wiki (top 3 results - visible in chat)')
					.addStringOption(option => option.setName('search')
						.setDescription('Text to search for on the wiki')
						.setRequired(false)),
				async execute(interaction) {
					return await wiki(interaction, false);
				}
			},
			{
				data: new SlashCommandBuilder().setName('search')
					.setDescription('Search ashesofcreation.wiki (top 5 results - not visible to others)')
					.addStringOption(option => option.setName('search')
						.setDescription('Text to search for on the wiki')
						.setRequired(false)),
				async execute(interaction) {
					return await wiki(interaction, true, 5);
				}
			},
			{
				data: new SlashCommandBuilder().setName('help')
					.setDescription('Using the ashesofcreation.wiki Discord bot'),
				async execute(interaction) {
					if (await cooldown(interaction)) return;
					const embed = new EmbedBuilder().setTitle(`** ashesofcreation.wiki Discord bot **`).setColor('#e69710').setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
						.addFields([{ name: `\`\`/wiki TEXT\`\``, value: `Search ashesofcreation.wiki for TEXT (top 3 results - visible in chat)` }
						.addFields([{ name: `\`\`/search TEXT\`\``, value: `Search ashesofcreation.wiki for TEXT (top 5 results - not visible to others)` },
						{ name: `\`\`/random\`\``, value: `Random article from ashesofcreation.wiki` },
						{ name: `\`\`/random CATEGORY\`\``, value: `Random article in CATEGORY` },
						{ name: 'Join our discord!', value: 'https://discord.gg/HEKx527' },
						{ name: 'Invite me to your discord!', value: 'https://top.gg/bot/506608731463876628' }]);
					if (config.command_cooldown) embed.setFooter({ text: `Command cooldown is set to ${config.command_cooldown / 1000} seconds` });
					await interaction.reply(await prepareMessageContent(embed));
				}
			},
			{
				data: new SlashCommandBuilder().setName('random')
					.setDescription('Random article from ashesofcreation.wiki')
					.addStringOption(option => option.setName('category').setDescription('Random article in category').setRequired(false)),
				async execute(interaction) {
					if (await cooldown(interaction)) return;
					await interaction.deferReply();
					const xhr = new XMLHttpRequest();
					const category = ucFirst(interaction.options.getString('category')).replace(/ /g, '_');
					if (category) await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}`, false);
					else await xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
					await xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
					await xhr.send(null);
					let location = xhr.getResponseHeader('location');
					if (!location && !category.match(/s$/i)) {
						await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}s`, false);
						await xhr.send(null);
						location = xhr.getResponseHeader('location');
					}
					await interaction.editReply(await prepareMessageContent(location ? await embedPage(location) : 'Random page not available. Try again later.'));
				}
			}
		];
		for (const slashCommand of globalSlashCommands) {
			global.client.commands.set(slashCommand.data.name, slashCommand);
		}
		await rest.put(Routes.applicationCommands(config.applicationId), {
			body: globalSlashCommands.map(sc => sc.data)
		}).catch(e => {
			console.error(e);
		});
		console.log(`Registered ${globalSlashCommands.length} global slash command(s)`);
		// Respond to slash commands
		global.client.on('interactionCreate', async interaction => {
			if (!interaction.isCommand()) return;
			const slashCommand = global.client.commands.get(interaction.commandName);
			if (!slashCommand) return;
			await slashCommand.execute(interaction).catch(console.error);
		});
	} catch (err) {
		console.error(err);
	}
};

export default initSlashCommands;
