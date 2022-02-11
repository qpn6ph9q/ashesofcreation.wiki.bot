import config from './config.json';

import { MessageEmbed } from 'discord.js';

import { XMLHttpRequest } from 'xmlhttprequest';

import { ucFirst, uriWikiEncode, getPageEmbed, embedPage, prepareMessageContent } from './utils.js';

async function prepareLegacyMessageContent(content) {
    if (content?.constructor?.name == 'MessageEmbed')
        content.setFooter({ text: 'Please use /wiki to search the wiki. The !wiki command will no longer work after April 30, 2022 due to Discord rule changes.' });
    return await prepareMessageContent(content);
}

export async function dispatcher (message) {
    if (message.author.bot) return;
    if (config.prefix) {
        const regex = new RegExp(`^[${config.prefix}]`, 's');
        message.content = message.content.replace(regex, '+');
    }
    if (!message.content.match(/^[+]/)) return;
    if (config.bans && config.bans.includes(message.member.id)) return console.log('%s is banned', message.member.id);
    const args = message.content.split(/ +/g);
    const command = args.shift().toLowerCase();
    const cooldown = async () => {
        if (config.immune && config.immune.includes(message.member.id)) return false;
        const cd = Math.floor((config.command_cooldown - (message.createdTimestamp - global.timestamp[message.channel.id])) / 1000);
        if (config.command_cooldown && cd > 0) {
            const m = await message.channel.send(await prepareLegacyMessageContent(`Command cooldown is in effect. ${cd} seconds remaining`))
            return true;
        }
        global.timestamp[message.channel.id] = message.createdTimestamp;
        return false;
    };
    const wiki = async () => {
        if (await cooldown()) return;
        const search = args.join(' ').replace(/_/g, ' ');
        if (search == '') {
            message.channel.send(await prepareLegacyMessageContent(await getPageEmbed('Ashes of Creation Wiki')));
            return;
        }
        try {
            return message.channel.send(await prepareLegacyMessageContent(await getPageEmbed(search)));
        }
        catch (e) {
            console.log('no exact match found for %s: %s', search, e);
        }
        const query = `https://ashesofcreation.wiki/api.php?action=query&format=json&prop=&list=search&srsearch=${uriWikiEncode(search)}&formatversion=2&&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet%7Csectiontitle%7Csectionsnippet&srenablerewrites=1`;
        const xhr = new XMLHttpRequest();
        await xhr.open('GET', query, false);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        if (xhr.readyState != 4)
            return message.channel.send(await prepareLegacyMessageContent('Page not found. Please try again later.'));
        const response = xhr.responseText;
        if (!response)
            return message.channel.send(await prepareLegacyMessageContent(await embedPage(search))).catch(err => {
                console.error(err);
            });
        let location = xhr.getResponseHeader('location');
        if (location)
            return message.channel.send(await prepareLegacyMessageContent(await embedPage(location)));
        const json = JSON.parse(response);
        if (!json || !json.query || !json.query.search)
            return message.channel.send(await prepareLegacyMessageContent('Missing response. Try again later.'));
        const result = json.query.search;
        if (!result)
            return message.channel.send(await prepareLegacyMessageContent('Invalid response format. Try again later.'));
        if (!result.length)
            return message.channel.send(await prepareLegacyMessageContent('No matching results. Try something else.'));
        if (result.length == 1) {
            return message.channel.send(await prepareLegacyMessageContent(await embedPage(result[0].title, result[0].sectiontitle))).catch(err => {
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
        message.channel.send(await prepareLegacyMessageContent(count == 1 ? 'Something went wrong. Try again later.' : embed)).catch(err => {
            console.error(err);
        });
    };
    const random = async () => {
        if (await cooldown()) return;
        const xhr = new XMLHttpRequest();
        const category = ucFirst(args.join('_').replace(/ /g, '_'));
        if (category)
            await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}`, false);
        else
            await xhr.open('GET', 'https://ashesofcreation.wiki/Special:Random', false);
        await xhr.setRequestHeader('Content-Type', 'text/plain;charset=iso-8859-1');
        await xhr.send(null);
        let location = xhr.getResponseHeader('location');
        if (!location && !category.match(/s$/i)) {
            await xhr.open('GET', `https://ashesofcreation.wiki/Special:RandomArticleInCategory/${category}s`, false);
            await xhr.send(null);
            location = xhr.getResponseHeader('location');
        }
        message.channel.send(await prepareLegacyMessageContent(location ? await embedPage(location) : 'Random page not available. Try again later.'));
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
            .addField(`\`\`/wiki TEXT\`\``, `Search ashesofcreation.wiki for TEXT (top 3 results)`)
            .addField(`\`\`/random\`\``, `Random article from ashesofcreation.wiki`)
            .addField(`\`\`/random CATEGORY\`\``, `Random article in CATEGORY`)
            .addField(`\`\`/quiz\`\``, `Take the Ashes of Creation Trivianator quiz`)
            .addField('Join our discord!', 'https://discord.gg/HEKx527')
            .addField('Invite me to your discord!', 'https://top.gg/bot/506608731463876628');
        message.channel.send(await prepareLegacyMessageContent(embed)).catch(err => {
            console.error(err);
        });
    };
    switch (command) {
        case "+wiki":
            return await wiki();
        case "+random":
            return await random();
        case "+quiz":
            return await quiz();
        case "+help":
            return await help();
        default:
            return;
    }
}

export default dispatcher;
