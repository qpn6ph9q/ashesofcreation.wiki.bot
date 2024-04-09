import { createRequire } from "module";
const require = createRequire(import.meta.url);
import config from './config.json';
import { REST, Routes, EmbedBuilder, Collection } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { stripHtml } from 'string-strip-html';
import { XMLHttpRequest } from 'xmlhttprequest';

const THUMBNAIL_SIZE = 800;
const MAX_TITLE_SIZE = 100;
const MAX_DESCRIPTION_SIZE = 349;
const HTTP_REQUEST_TIMEOUT = 4000;

async function HTTPRequest(url, contentType = 'text/plain;charset=iso-8859-1') {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		if (config.debug)
			console.log(`HTTPRequest: ${url}`);
		request.addEventListener('readystatechange', () => {
			if (request.readyState == 4) {
				if (request.status && request.status != 200) {
					if (config.debug)
						console.log(`Request for ${url} failed: readyState: ${request.readyState}, status: ${request.status}`);
					reject('Page not found. Please try again later.');
				}
				else
					resolve(request);
			}
		});
		request.open('GET', url);
		request.timeout = HTTP_REQUEST_TIMEOUT;
		request.setRequestHeader('Content-Type', contentType);
		request.ontimeout = () => {
			reject(`Request timed out!`);
			if (config.debug)
				console.log(`Request timed out: ${url}`);
		};
		request.send();
	});
}

function sanitizeAndTruncate(str, length) {
	if (!str) return '';
	str = stripHtml(str).result;
	if(!length)
		return str;
	if (str.length > length - 3) return `${str.substring(0, length).trim()}...`;
}

function ucFirst(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function uriWikiEncode(uri, fragment) {
	uri = ucFirst(uri);
	uri = uri.replace(/ /g, '_');
	if (fragment) return `${encodeURIComponent(uri)}#${encodeURIComponent(fragment)}`;
	return encodeURIComponent(uri);
}

async function getPageEmbed(title, fragment, is_redirect = false) {
	let matches;
	if (matches = title.match(/\/?([^#]+)#(.+)$/)) {
		fragment = matches[2];
		title = matches[1];
	} else if (matches = title.match(/\/([^\/]+)$/)) title = matches[1];
	title = decodeURIComponent(decodeURIComponent(title));
	if (fragment) {
		fragment = decodeURIComponent(decodeURIComponent(fragment));
		title = `${title}#${fragment}`;
	}
	const fragmentparams = fragment ? 'exsectionformat=wiki' : 'exintro=1';
	const uri = `${config.endpoint}/api.php?action=query&format=json&prop=pageimages%7Cextracts%7Cpageprops&list=&titles=${uriWikiEncode(title)}&redirects=1&pithumbsize=${THUMBNAIL_SIZE}&formatversion=2&${fragmentparams}&redirects=1&converttitles=1`;
	const response = await HTTPRequest(uri);
	if (!response?.responseText) throw 'Bad or missing response. Try again later.';
	const json = JSON.parse(response.responseText);
	if (config.debug)
		console.log({ uri, response, json });
	if (!json?.query?.pages?.length) throw 'Missing or invalid response. Try again later.';
	if (!is_redirect && json.query.redirects && json.query.redirects.length && json.query.redirects[0].to) return await getPageEmbed(json.query.redirects[0].to, json.query.redirects[0].tofragment, true);
	const page = json.query.pages[0];
	let page_uri = uriWikiEncode(page.title);
	if (fragment) page_uri += `#${uriWikiEncode(fragment)}`;
	if (page.missing && !is_redirect && page.title) {
		const redir = await HTTPRequest(`${config.endpoint}/${page_uri}`);
		const location = redir.getResponseHeader('location');
		if (!location) {
			const ci_query = `https://ashesofcreation.wiki/api.php?action=opensearch&format=json&search=${uriWikiEncode(title)}&namespace=0&limit=6&redirects=return`;
			const ci_response = await HTTPRequest(ci_query);
			const ci_json = JSON.parse(ci_response.responseText);
			const ci_location = ci_json?.[1]?.[0];
			if (config.debug)
				console.log({ ci_query, ci_response, ci_json, ci_location });
			if (!ci_location)
				throw 'Not found';
			if (config.debug)
				console.log(`case senstive redirect to ${location}`);
			return await getPageEmbed(ci_location, null, true);
		}
		if (config.debug)
			console.log(`redirecting to ${location}`);
		return await getPageEmbed(location, null, true);
	}
	const page_url = `https://ashesofcreation.wiki/${page_uri}`;
	let description = page.extract;
	let page_title = page.title;
	if (fragment) {
		const regex = new RegExp(`<span id="${fragment}">${fragment}</span>(.+?)<span id=`, 's');
		if (matches = `${description}<span id="">`.match(regex)) {
			page_title = fragment;
			description = matches[1];
		}
	}
	if (!description && page.pageprops && page.pageprops.description) description = page.pageprops.description;
	const embed = new EmbedBuilder()
		.setAuthor({ name: 'Ashes of Creation Wiki' })
		.setTitle(sanitizeAndTruncate(page_title, MAX_TITLE_SIZE))
		.setColor('#e69710')
		.setURL(page_url)
		.addFields({ name: `Learn more here`, value: `${page_url}` });
	if (description)
		embed.setDescription(sanitizeAndTruncate(description, MAX_DESCRIPTION_SIZE));
	if (page?.thumbnail?.source) embed.setImage(page.thumbnail.source);
	return embed;
}

async function embedPage(title, fragment, is_redirect = false) {
	try {
		return await getPageEmbed(title, fragment, is_redirect);
	} catch (e) {
		return e;
	}
}

async function prepareMessageContent(content, text) {
	//console.log({ content, text });
	if (content && typeof content === 'object') {
		switch (content?.constructor?.name) {
			case 'EmbedBuilder':
				return text ? { content: text, embeds: [content] } : { embeds: [content] };
			case 'Number':
			case 'String':
			case 'undefined':
				break;
			default:
				content = content.toString();
		}
	}
	if (!content)
		return text ? { content: text } : '??';
	return text ? { content: [content, text] } : content;
};

const cooldown = async (interaction) => {
	if (!interaction?.member?.id) return false;
	if (config.immune && config.immune.includes(interaction.member.id)) return false;
	const cd = Math.floor((config.command_cooldown - (interaction.createdTimestamp - global.timestamp[interaction.channelId])) / 1000);
	if (config.command_cooldown && cd > 0) {
		const m = await interaction.reply(await prepareMessageContent(`Command cooldown is in effect. ${cd} seconds remaining`))
		return true;
	}
	global.timestamp[interaction.channelId] = interaction.createdTimestamp;
	return false;
};

async function initSlashCommands() {
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
		const query = `${config.endpoint}/api.php?action=query&format=json&prop=&list=search&srsearch=${uriWikiEncode(search)}&formatversion=2&&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet%7Csectiontitle%7Csectionsnippet&srenablerewrites=1`;
		const response = await HTTPRequest(query);
		if (!response?.responseText) return await interaction.editReply(await prepareMessageContent(await embedPage(search))).catch(err => {
			console.error(err);
		});
		let location = response.getResponseHeader('location');
		if (location) return await interaction.editReply(await prepareMessageContent(await embedPage(location)));
		const json = JSON.parse(response.responseText);
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
					.setDefaultMemberPermissions().setDMPermission(true)
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
					.setDefaultMemberPermissions().setDMPermission(true)
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
					.setDefaultMemberPermissions().setDMPermission(true)
					.setDescription('Using the ashesofcreation.wiki Discord bot'),
				async execute(interaction) {
					if (await cooldown(interaction)) return;
					const embed = new EmbedBuilder().setTitle(`** ashesofcreation.wiki Discord bot **`).setColor('#e69710').setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
						.addFields([{ name: `\`\`/wiki TEXT\`\``, value: `Search ashesofcreation.wiki for TEXT (top 3 results - visible in chat)` },
						{ name: `\`\`/search TEXT\`\``, value: `Search ashesofcreation.wiki for TEXT (top 5 results - not visible to others)` },
						{ name: `\`\`/random\`\``, value: `Random article from ashesofcreation.wiki` },
						{ name: `\`\`/random CATEGORY\`\``, value: `Random article in CATEGORY` },
						{ name: 'Join our discord!', value: 'https://discord.gg/HEKx527' },
						{ name: 'Invite me to your discord!', value: 'https://goo.gl/DMB3Sr' }]);
					if (config.debug) embed.setFooter({ text: `In debug mode` });
					else if (config.command_cooldown) embed.setFooter({ text: `Command cooldown is set to ${config.command_cooldown / 1000} seconds` });
					await interaction.reply(await prepareMessageContent(embed));
				}
			},
			{
				data: new SlashCommandBuilder().setName('random')
					.setDefaultMemberPermissions().setDMPermission(true)
					.setDescription('Random article from ashesofcreation.wiki')
					.addStringOption(option => option.setName('category').setDescription('Random article in category').setRequired(false)),
				async execute(interaction) {
					if (await cooldown(interaction)) return;
					await interaction.deferReply();
					const category = ucFirst(interaction.options.getString('category')).replace(/ /g, '_');
					const request = category ? `${config.endpoint}/Special:RandomArticleInCategory/${category}` : `${config.endpoint}/Special:Random`;
					/* TODO: Investigate why this buggs out
					const response = await HTTPRequest(request);
					let location = response.getResponseHeader('location');
					if(config.debug)
						console.log({location});
					if (category && !location && !category.match(/s$/i)) {
						const pluralResponse = await HTTPRequest(`${config.endpoint}/Special:RandomArticleInCategory/${category}s`);
						location = pluralResponse.getResponseHeader('location');
					}
					*/
					const xhr = new XMLHttpRequest();
					await xhr.open('GET', request, false);
					await xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
					await xhr.send(null);
					let location = xhr.getResponseHeader('location');
					if (!location && !category.match(/s$/i)) {
						await xhr.open('GET', `${config.endpoint}/Special:RandomArticleInCategory/${category}s`, false);
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
