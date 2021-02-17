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
    client.user.setActivity(` on ${client.guilds.cache.size} discords | +help`, {
        type: 'PLAYING'
    })
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

function uriWikiDecode(uri) {
    return uriWikiEncode(decodeURI(uri));
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
async function dispatcher(message) {
    if (message.author.bot) return;
    const config = message.member.guild.id in base_config ? base_config[message.member.guild.id] : base_config;
    const args = message.content.split(/ +/g);
    const command = args.shift().toLowerCase();
    const cooldown = async () => {
        if (config.command_cooldown && global.timestamp[message.channel.id] && message.createdTimestamp - global.timestamp[message.channel.id] < config.command_cooldown) {
            const m = await message.channel.send(`Command cooldown is in effect. ${Math.floor((config.command_cooldown - (message.createdTimestamp - global.timestamp[message.channel.id]))/1000)} seconds remaining`)
            return true;
        }
        global.timestamp[message.channel.id] = message.createdTimestamp;
        return false;
    };
    const ping = async () => {
        if (await cooldown()) return;
        const m = await message.channel.send('test');
        m.edit(`Ping latency: ${m.createdTimestamp - message.createdTimestamp}ms. API Latency: ${Math.round(client.ws.ping)}ms`);
    };
    const wiki = async () => {
        if (await cooldown()) return;
        const search = args.join(' ').replace(/_/g, ' ');
        if (search == '') {
            message.channel.send('https://ashesofcreation.wiki');
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
            const response = xhr.responseText;
            if (!response) {
                message.channel.send(`https://ashesofcreation.wiki/${uriWikiEncode(search)}`).catch(err => {
                    console.error(err);
                });
                return;
            }
            const location = xhr.getResponseHeader('location');
            if (location) {
                message.channel.send(`https://ashesofcreation.wiki${location}`);
                return;
            }
            const json = JSON.parse(response);
            if (!json || !json.__main__ || !json.__main__.result) {
                message.channel.send('Missing response. Try again later.');
                return;
            }
            const result = json.__main__.result;
            if (!result) {
                message.channel.send('Invalid response format. Try again later.');
                return;
            }
            if (!result.hits || !result.hits.hits || !result.hits.hits.length) {
                message.channel.send('No matching results. Try something else.');
                return;
            }
            if (!result.hits.total) {
                message.channel.send(`${args.join(' ')} not found. Try something else.`);
                return;
            }
            if (result.hits.total == 1) {
                message.channel.send(`https://ashesofcreation.wiki/${uriWikiEncode(result.hits.hits[0]._source.title)}`).catch(err => {
                    console.error(err);
                });
                return;
            }
            result.hits.hits.length = 3;
            const embed = new MessageEmbed().setTitle(`${command} results`).setColor('#e69710');
            let count = 1;
            for (const hit of result.hits.hits) {
                if (!hit || !hit._source || !hit._source.title || !hit.highlight || !hit.highlight.text) continue;
                let m = hit.highlight.text.toString();
                m = m.replace(/<span[^>]+>([^<]+)<\/span>/g, '***$1***');
                m = m.replace(/\uE000([^\uE001]+)\uE001/g, '***$1***');
                m = m.replace(/<[^>]+>/g, '');
                embed.addField(`${count}: <https://ashesofcreation.wiki/${uriWikiEncode(hit._source.title)}>`, `...${m}...`);
                count++;
            };
            message.channel.send(count == 1 ? 'Something went wrong. Try again later.' : embed).catch(err => {
                console.error(err);
            });
        });
        const query = `https://ashesofcreation.wiki/Special:Search?cirrusDumpResult=&search=${uriWikiEncode(search)}`;
        xhr.open('GET', query, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        xhr.send();
    };
    const random = async () => {
        if (await cooldown()) return;
        const xhr = new XMLHttpRequest();
        let category = ucFirst(args.join('_').replace(/ /g, '_'));
        xhr.addEventListener('load', () => {
            const location = xhr.getResponseHeader('location');
            if (!location && !category.match(/s$/i)) {
                category += 's';
                xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomInCategory/${category}`, false);
                xhr.send();
            } else message.channel.send(location || 'Random page not available. Try again later.');
        });
        if (category) xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomInCategory/${category}`, false);
        else xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        xhr.send();
    };
    const quiz = async () => {
        if (await cooldown()) return;
        message.channel.send('https://quiz.ashesofcreation.wiki/quiz_list_guest/');
    };
    const help = async () => {
        if (await cooldown()) return;
        const embed = new MessageEmbed().setTitle(`** ashesofcreation.wiki Discord bot **`).setColor('#e69710').setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!').addField(`\`\`${config.prefix}wiki TEXT\`\``, `Search ashesofcreation.wiki for TEXT (top 3 results)`).addField(`\`\`${config.prefix}random\`\``, `Random article from  ashesofcreation.wiki`).addField(`\`\`${config.prefix}quiz\`\``, `Take the Ashes of Creation Trivianator quiz`).addField('Join our discord!', 'https://discord.gg/HEKx527').addField('Invite me to your discord!', 'https://goo.gl/DMB3Sr');
        if (config.command_cooldown) embed.setFooter(`Command cooldown is set to ${config.command_cooldown/1000} seconds`);
        message.channel.send(embed).catch(err => {
            console.error(err);
        });
    };
    switch (command) {
        case "+ping":
            return await ping();
        case "+wiki":
        case "!wiki":
            return await wiki();
        case "+random":
        case "!random":
            return await random();
        case "+quiz":
        case "!quiz":
            return await quiz();
        case "+help":
            return await help();
        default:
            return;
    }
}
client.on('message', async message => {
    await dispatcher(message).catch((e) => {
        console.error({
            dispatcher: e
        });
    });
});
client.login(base_config.token);
