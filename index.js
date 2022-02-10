import {
    Client,
    MessageEmbed,
    Collection
} from 'discord.js';
import {
    REST
} from '@discordjs/rest';
const client = new Client({
    intents: [  ]
});
import config from './config.json';
import {
    SlashCommandBuilder
} from '@discordjs/builders';
import {
    Routes
} from 'discord-api-types/v9';
import { XMLHttpRequest } from 'xmlhttprequest';
import { stripHtml } from 'string-strip-html';
try {
    if (config.topggtoken) {
        const topgg = require('topgg-autoposter')
        const ap = topgg(config.topggtoken, client);
        ap.on('posted', () => {
            console.log('Posted stats to top.gg');
        });
    }
} catch (e) {
    console.error({
        topgg_exception: e
    });
}
const ucFirst = (str) => {
    if(!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const setActivity = () => {
    client.user.setActivity(` on ${client.guilds.cache.size} discords | +help`, {
        type: 'PLAYING'
    })
};
const uriWikiEncode = (uri, fragment) => {
    uri = ucFirst(uri);
    uri = uri.replace(/ /g, '_');
    if (fragment) return `${encodeURIComponent(uri)}#${encodeURIComponent(fragment)}`;
    return encodeURIComponent(uri);
};
const THUMBNAIL_SIZE = 800;
const DESCRIPTION_SIZE = 349;
const getPageEmbed = async (title, fragment, is_redirect = false) => {
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
    const uri = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=pageimages%7Cextracts%7Cpageprops&list=&titles=${uriWikiEncode(title)}&redirects=1&pithumbsize=${THUMBNAIL_SIZE}&formatversion=2&${fragmentparams}&redirects=1&converttitles=1`;
    const xhr = new XMLHttpRequest();
    await xhr.open('GET', uri, false);
    await xhr.send(null);
    if (xhr.readyState != 4 || xhr.status != 200) throw 'Page not found. Please try again later.';
    const response = xhr.responseText;
    const json = JSON.parse(response);
    if (!json || !json.query || !json.query.pages || !json.query.pages.length) throw 'Missing response. Try again later.';
    if (!is_redirect && json.query.redirects && json.query.redirects.length && json.query.redirects[0].to) return await getPageEmbed(json.query.redirects[0].to, json.query.redirects[0].tofragment, true);
    const page = json.query.pages[0];
    let page_url = `https://ashesofcreation.wiki/${uriWikiEncode(page.title)}`;
    if (fragment) page_url += `#${uriWikiEncode(fragment)}`;
    if (page.missing && !is_redirect && page.title) {
        const xhr = new XMLHttpRequest();
        await xhr.open('GET', page_url, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState == 4 && xhr.responseText) {
            const location = xhr.getResponseHeader('location');
            if (location) return await getPageEmbed(location, null, true);
            throw 'Not found';
        }
    }
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
    const embed = new MessageEmbed().setAuthor('Ashes of Creation Wiki').setTitle(page_title).setColor('#e69710').setURL(page_url).addField(`Learn more here`, `${page_url}`);
    if (description) {
        description = stripHtml(description).result;
        if (description.length > DESCRIPTION_SIZE) description = description.substring(0, DESCRIPTION_SIZE).trim() + '...';
        embed.setDescription(description);
    }
    if (page.thumbnail && page.thumbnail.source) embed.setImage(page.thumbnail.source);
    return embed;
};
const embedPage = async (title, fragment, is_redirect = false) => {
    try {
        return await getPageEmbed(title, fragment, is_redirect);
    } catch (e) {
        return e;
    }
};
global.timestamp = {};
const cooldown = async (interaction) => {
    if (!interaction?.member) {
        console.error('invalid_interaction', interaction);
        return true;
    }
    if (config.immune && config.immune.includes(interaction.member.id)) return false;
    const cd = Math.floor((config.command_cooldown - (message.createdTimestamp - global.timestamp[interaction.channelId])) / 1000);
    if (config.command_cooldown && cd > 0) {
        const m = await interaction.reply(`Command cooldown is in effect. ${cd} seconds remaining`)
        return true;
    }
    global.timestamp[interaction.channelId] = interaction.createdTimestamp;
    return false;
};
const prepareMessageContent = async (content, text) => {
    if (content && typeof content === 'object') {
        switch (content?.constructor?.name) {
            case 'MessageEmbed':
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
        return text ? { content: text } : '';
    return text ? { content: [content, text] } : { content: content };
};
const initSlashCommands = async () => {
    const rest = new REST({
        version: '9'
    }).setToken(config.token);
    if (!rest) throw `Rest API is not enabled.`;
    client.commands = new Collection();
    try {
        // Register global slash commands
        const globalSlashCommands = [
            {
                data: new SlashCommandBuilder().setName('wiki').setDescription('Search ashesofcreation.wiki (top 3 results)')
		    .addStringOption(option => option.setName('search').setDescription('Text to search for on the wiki').setRequired(false)),
                async execute(interaction) {
                    if (await cooldown(interaction)) return;
                    const search = interaction.options.getString('search');
                    if (!search) return await interaction.reply('https://ashesofcreation.wiki');
                    try {
                        return await interaction.reply(await prepareMessageContent(await getPageEmbed(search)));
                    } catch (e) {
                        console.log('no exact match found for %s: %s', search, e);
                    }
                    const query = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=&list=search&srsearch=${uriWikiEncode(search)}&formatversion=2&&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet%7Csectiontitle%7Csectionsnippet&srenablerewrites=1`;
                    const xhr = new XMLHttpRequest();
                    await xhr.open('GET', query, false);
                    xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
                    await xhr.send(null);
                    if (xhr.readyState != 4) return await interaction.reply('Page not found. Please try again later.');
                    const response = xhr.responseText;
                    if (!response) return await interaction.reply(await prepareMessageContent(await embedPage(search))).catch(err => {
                        console.error(err);
                    });
                    let location = xhr.getResponseHeader('location');
                    if (location) return await interaction.reply(await prepareMessageContent(await embedPage(location)));
                    const json = JSON.parse(response);
                    if (!json || !json.query || !json.query.search) return await interaction.reply('Missing response. Try again later.');
                    const result = json.query.search;
                    if (!result) return await interaction.reply('Invalid response format. Try again later.');
                    if (!result.length) return await interaction.reply('No matching results. Try something else.');
                    if (result.length == 1) {
                        return await interaction.reply(await prepareMessageContent(await embedPage(result[0].title, result[0].sectiontitle))).catch(err => {
                            console.error(err);
                        });
                    }
                    result.length = 3;
                    const embed = new MessageEmbed().setTitle(`Ashes of Creation Wiki search results`).setColor('#e69710');
                    let count = 1;
                    for (const hit of result) {
                        if (!hit || !hit.title) continue;
                        let m = hit.snippet.toString();
                        m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
                        m = m.replace(/\uE000([^\uE001]+)\uE001/g, '***$1***');
                        m = m.replace(/<[^>]+>/g, '');
                        m = m.replace(/&quot;/g, '"');
                        m = m.replace(/&amp;/g, '&');
                        embed.addField(`${count}: <https://ashesofcreation.wiki/${uriWikiEncode(hit.title, hit.sectiontitle)}>`, `...${m}...`);
                        count++;
                    };
                    await interaction.reply(await prepareMessageContent(count == 1 ? 'Something went wrong. Try again later.' : embed)).catch(err => {
                        console.error(err);
                    });
                }
            },
            {
                data: new SlashCommandBuilder().setName('help').setDescription('Using the ashesofcreation.wiki Discord bot'),
                async execute(interaction) {
                    if (await cooldown(interaction)) return;
                    const embed = new MessageEmbed().setTitle(`** ashesofcreation.wiki Discord bot **`).setColor('#e69710').setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
				.addField(`\`\`/wiki search\`\``, `Search ashesofcreation.wiki (top 3 results)`)
				.addField(`\`\`/random\`\``, `Random article from ashesofcreation.wiki`)
				.addField(`\`\`/random category\`\``, `Random article in category`)
				.addField(`\`\`/wikiquiz\`\``, `Take the Ashes of Creation Trivianator quiz`)
				.addField('Join our discord!', 'https://discord.gg/HEKx527')
				.addField('Invite me to your discord!', 'https://top.gg/bot/506608731463876628');
                    if (config.command_cooldown) embed.setFooter(`Command cooldown is set to ${config.command_cooldown / 1000} seconds`);
                    await interaction.reply(await prepareMessageContent(embed));
                }
            },
            {
                data: new SlashCommandBuilder().setName('random').setDescription('Random article from ashesofcreation.wiki')
		    .addStringOption(option => option.setName('category').setDescription('Random article in category').setRequired(false)),
                async execute(interaction) {
                    if (await cooldown(interaction)) return;
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
                    await interaction.reply(await prepareMessageContent(location ? await embedPage(location) : 'Random page not available. Try again later.'));
                }
            },
            {
                data: new SlashCommandBuilder().setName('quiz').setDescription('Take the Ashes of Creation Trivianator quiz'),
                async execute(interaction) {
                    if (await cooldown(interaction)) return;
                    return await interaction.reply('https://quiz.ashesofcreation.wiki/quiz_list_guest/');
                }
            }
        ];
        for (const slashCommand of globalSlashCommands) {
            client.commands.set(slashCommand.data.name, slashCommand);
        }
        await rest.put(Routes.applicationCommands(config.applicationId), {
            body: globalSlashCommands.map(sc => sc.data)
        }).catch(e => {
            console.error(e);
        });
        console.log(`Registered ${globalSlashCommands.length} global slash command(s)`);
        // Respond to slash commands
        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;
            const slashCommand = client.commands.get(interaction.commandName);
            if (!slashCommand) return;
            await slashCommand.execute(interaction);
        });
    } catch (err) {
        console.error(err);
    }
};
client.on('ready', () => {
    console.log(`Bot starting in ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);
    setActivity();
    initSlashCommands();
});
client.on('guildCreate', guild => {
    console.log(`Bot joining ${guild.name} with ${guild.memberCount} members`);
    setActivity();
});
client.on('guildDelete', guild => {
    console.log(`Bot leaving ${guild.name}`);
    setActivity();
});
client.login(config.token);
