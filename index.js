const {
    Client,
    MessageEmbed,
    Emoji,
    MessageReaction
} = require('discord.js');
const client = new Client();
const base_config = require('./config.json');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const {
    stripHtml
} = require('string-strip-html');
const ucFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const setActivity = () => {
    client.user.setActivity(` on ${client.guilds.cache.size} discords | +help`, {
        type: 'PLAYING'
    })
};
const uriWikiEncode = (uri) => {
    uri = ucFirst(uri);
    uri = uri.replace(/ /g, '_');
    return encodeURI(uri);
};
const uriWikiDecode = (uri) => {
    return uriWikiEncode(decodeURI(uri));
};
const THUMBNAIL_SIZE = 400;
const DESCRIPTION_SIZE = 349;
const embedPage = async (title, is_test = false, is_redirect = false) => {
    let matches;
    if(matches = title.match(/\/([^\/]+)$/))
        title = matches[1];
    if(!is_test)
	return `https://ashesofcreation.wiki/${uriWikiEncode(title)}`;
    //console.log({title:title});
    const uri = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=pageimages%7Cextracts%7Cpageprops&list=&titles=${uriWikiEncode(title)}&redirects=1&pithumbsize=${THUMBNAIL_SIZE}&formatversion=2`;
    const xhr = new XMLHttpRequest();
    await xhr.open('GET', uri, false);
    await xhr.send(null);
    if (xhr.readyState != 4 || xhr.status != 200)
        return 'Page not found. Please try again later.';
    const response = xhr.responseText;
    //console.log(response);
    const json = JSON.parse(response);
    if (!json || !json.query || !json.query.pages || !json.query.pages.length)
        return 'Missing response. Try again later.';
    if(!is_redirect && json.query.redirects && json.query.redirects.length && json.query.redirects[0].to)
	return await embedPage(uriWikiEncode(json.query.redirects[0].to), is_test, true);
    const page = json.query.pages[0];
    //console.log(page);
    const embed = new MessageEmbed()
        .setAuthor('Ashes of Creation Wiki')
        .setTitle(page.title)
        .setColor('#e69710')
        .setURL(`https://ashesofcreation.wiki/${uriWikiEncode(title)}`);
    let description = page.extract;
    if(!description && page.pageprops && page.pageprops.description) description = page.pageprops.description;
    if(description) {
	description = stripHtml(description).result;
        if (description.length > DESCRIPTION_SIZE) description = description.substring(0, DESCRIPTION_SIZE).trim() + '...';
        embed.setDescription(description);
    }
    if (page.thumbnail && page.thumbnail.source) embed.setImage(page.thumbnail.source);
    return embed;
};
global.timestamp = {};
const dispatcher = async (message) => {
    if (message.author.bot) return;
    if (!message.content.match(/^[!+]/)) return;
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
    const wiki = async (is_test = true) => {
        if (await cooldown()) return;
        const search = args.join(' ').replace(/_/g, ' ');
        if (search == '') {
            message.channel.send('https://ashesofcreation.wiki');
            return;
        }
        const xhr = new XMLHttpRequest();
        const query = `https://ashesofcreation.wiki/Special:Search?cirrusDumpResult=&search=${uriWikiEncode(search)}`;
        await xhr.open('GET', query, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState != 4)
            return message.channel.send('Page not found. Please try again later.');
        const response = xhr.responseText;
        if (!response)
            return message.channel.send(await embedPage(search, is_test)).catch(err => {
                console.error(err);
            });
        const location = xhr.getResponseHeader('location');
        if (location) 
	    return message.channel.send(await embedPage(location, is_test));
        const json = JSON.parse(response);
        if (!json || !json.__main__ || !json.__main__.result)
            return message.channel.send('Missing response. Try again later.');
        const result = json.__main__.result;
        if (!result)
            return message.channel.send('Invalid response format. Try again later.');
        if (!result.hits || !result.hits.hits || !result.hits.hits.length)
            return message.channel.send('No matching results. Try something else.');
        if (!result.hits.total)
            return message.channel.send(`${args.join(' ')} not found. Try something else.`);
        if (result.hits.total == 1)
            return message.channel.send(await embedPage(result.hits.hits[0]._source.title, is_test)).catch(err => {
                console.error(err);
            });
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
    };
    const random = async (is_test = true) => {
        if (await cooldown()) return;
        const xhr = new XMLHttpRequest();
        let category = ucFirst(args.join('_').replace(/ /g, '_'));
        if (category)
            await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomInCategory/${category}`, false);
        else
            await xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
        await xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        const location = xhr.getResponseHeader('location');
        if (!location && !category.match(/s$/i)) {
            category += 's';
            xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomInCategory/${category}`, false);
            xhr.send();
        } else 
            message.channel.send(location ? await embedPage(location, is_test) : 'Random page not available. Try again later.');
    };
    const quiz = async () => {
        if (await cooldown()) return;
        message.channel.send('https://quiz.ashesofcreation.wiki/quiz_list_guest/');
    };
    const help = async () => {
        if (await cooldown()) return;
        const embed = new MessageEmbed()
            .setTitle(`** ashesofcreation.wiki Discord bot **`)
            .setColor('#e69710')
            .setDescription('Concise and accurate information on Ashes of Creation from https://ashesofcreation.wiki delivered directly to your Discord!')
            .addField(`\`\`+wiki TEXT\`\``, `Search ashesofcreation.wiki for TEXT (top 3 results)`)
            .addField(`\`\`+random\`\``, `Random article from  ashesofcreation.wiki`)
            .addField(`\`\`+quiz\`\``, `Take the Ashes of Creation Trivianator quiz`)
            .addField('Join our discord!', 'https://discord.gg/HEKx527')
            .addField('Invite me to your discord!', 'https://goo.gl/DMB3Sr');
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
        case "+test":
            return await wiki(true);
        case "+random":
        case "!random":
            return await random();
	case "+testrandom":
            return await random(true);
        case "+quiz":
        case "!quiz":
            return await quiz();
        case "+help":
            return await help();
        default:
            return;
    }
};
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
client.on('message', async message => {
    await dispatcher(message).catch((e) => {
        console.error({
            dispatcher: e
        });
    });
});
client.login(base_config.token);

